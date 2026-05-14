import { Router, Request, Response } from "express";
import StellarSdk from "@stellar/stellar-sdk";
import { recordVote, clearVotes, listProposals } from "../services/voteStore";
import { getOnChainVotes } from "../services/sorobanRpc";
import { sendFreezeProposalNotification } from "../services/fcmService";

export const freezeRouter = Router();

const HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const CONTRACT_ID = process.env.FREEZE_CONTRACT_ID ?? "";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const QUORUM = 3;

function isValidAddress(addr: string): boolean {
  try { StellarSdk.StrKey.decodeEd25519PublicKey(addr); return true; } catch { return false; }
}

function isValidAssetCode(code: string): boolean {
  return /^[A-Z0-9]{1,12}$/.test(code);
}

// GET /api/freeze/proposals — vote counts are read from chain when available
freezeRouter.get("/proposals", async (_req: Request, res: Response) => {
  const rows = listProposals();
  const proposals = await Promise.all(
    rows.map(async (b) => {
      const onChain = await getOnChainVotes(b.assetCode, b.issuer, b.target);
      return {
        assetCode: b.assetCode,
        issuer: b.issuer,
        target: b.target,
        // Prefer on-chain count; fall back to audit log count if RPC unavailable
        votes: onChain ?? b.voters.length,
        source: onChain !== null ? "chain" : "local",
      };
    })
  );
  res.json(proposals);
});

// POST /api/freeze/build
freezeRouter.post("/build", async (req: Request, res: Response) => {
  const { assetCode, issuer, target, adminKey } = req.body;
  if (!assetCode || !issuer || !target || !adminKey)
    return res.status(400).json({ error: "Missing required fields" });
  if (!isValidAssetCode(assetCode))
    return res.status(400).json({ error: "Invalid asset code (1-12 uppercase alphanumeric)" });
  if (!isValidAddress(issuer) || !isValidAddress(target) || !isValidAddress(adminKey))
    return res.status(400).json({ error: "Invalid Stellar address" });
  if (!CONTRACT_ID)
    return res.status(503).json({ error: "ContractNotFound: FREEZE_CONTRACT_ID not configured" });

  try {
    const account = await server.loadAccount(adminKey);
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "vote_freeze",
          StellarSdk.Address.fromString(adminKey).toScVal(),
          StellarSdk.xdr.ScVal.scvString(assetCode),
          StellarSdk.Address.fromString(issuer).toScVal(),
          StellarSdk.Address.fromString(target).toScVal()
        )
      )
      .setTimeout(30)
      .build();
    return res.json({ xdr: tx.toXDR() });
  } catch (e: any) {
    if (e.message?.includes("timeout") || e.code === "ECONNREFUSED")
      return res.status(504).json({ error: "NetworkTimeout: Horizon unreachable" });
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/freeze/submit — record in audit log, read authoritative count from chain
freezeRouter.post("/submit", async (req: Request, res: Response) => {
  const { signedXdr, assetCode, issuer, target } = req.body;
  if (!signedXdr || !assetCode || !issuer || !target)
    return res.status(400).json({ error: "signedXdr, assetCode, issuer, target required" });
  if (!isValidAssetCode(assetCode) || !isValidAddress(issuer) || !isValidAddress(target))
    return res.status(400).json({ error: "Invalid asset code or address" });

  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET);
    const adminKey = tx.source;
    if (!isValidAddress(adminKey))
      return res.status(400).json({ error: "Invalid transaction source" });

    // Submit to network first — the contract enforces all auth/quorum rules
    const result = await server.submitTransaction(
      StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET) as any
    );

    // Record in audit log regardless of quorum state
    const auditCount = recordVote(assetCode, issuer, target, adminKey);

    // Send FCM push notification on the first vote for a new proposal
    if (auditCount === 1) {
      sendFreezeProposalNotification(assetCode, target).catch(() => {/* non-fatal */});
    }

    // Read authoritative vote count from chain
    const onChainVotes = await getOnChainVotes(assetCode, issuer, target);
    const votes = onChainVotes ?? 0;

    if (votes === 0) {
      // Count dropped to 0 → quorum was reached and proposal was cleared on-chain
      clearVotes(assetCode, issuer, target);
      return res.json({ status: "executed", votes: QUORUM, hash: result.hash });
    }

    return res.json({ status: "vote_recorded", votes, quorum: QUORUM, hash: result.hash });
  } catch (e: any) {
    if (e.response?.data?.extras?.result_codes?.transaction === "tx_bad_auth")
      return res.status(403).json({ error: "UnauthorizedFreezeAttempt" });
    return res.status(500).json({ error: e.message });
  }
});
