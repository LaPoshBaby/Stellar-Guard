import { Router, Request, Response } from "express";
import StellarSdk from "@stellar/stellar-sdk";

export const freezeRouter = Router();

const HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const CONTRACT_ID = process.env.FREEZE_CONTRACT_ID ?? "";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

interface VoteBucket {
  assetCode: string;
  issuer: string;
  target: string;
  voters: Set<string>;
}

// In-memory vote store keyed by "assetCode:issuer:target"
const voteStore = new Map<string, VoteBucket>();
const QUORUM = 3;

function voteKey(assetCode: string, issuer: string, target: string) {
  return `${assetCode}:${issuer}:${target}`;
}

// GET /api/freeze/proposals — list pending proposals (used by mobile app)
freezeRouter.get("/proposals", (_req: Request, res: Response) => {
  const proposals = Array.from(voteStore.values()).map((b) => ({
    assetCode: b.assetCode,
    issuer: b.issuer,
    target: b.target,
    votes: b.voters.size,
  }));
  res.json(proposals);
});

// POST /api/freeze/build — returns unsigned XDR for admin to sign
freezeRouter.post("/build", async (req: Request, res: Response) => {
  const { assetCode, issuer, target, adminKey } = req.body;
  if (!assetCode || !issuer || !target || !adminKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!CONTRACT_ID) {
    return res.status(503).json({ error: "ContractNotFound: FREEZE_CONTRACT_ID not configured" });
  }
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
          StellarSdk.xdr.ScVal.scvSymbol(assetCode),
          StellarSdk.Address.fromString(issuer).toScVal(),
          StellarSdk.Address.fromString(target).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    return res.json({ xdr: tx.toXDR() });
  } catch (e: any) {
    if (e.message?.includes("timeout") || e.code === "ECONNREFUSED") {
      return res.status(504).json({ error: "NetworkTimeout: Horizon unreachable" });
    }
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/freeze/submit — submit signed XDR and record vote
freezeRouter.post("/submit", async (req: Request, res: Response) => {
  const { signedXdr, assetCode, issuer, target } = req.body;
  if (!signedXdr || !assetCode || !issuer || !target) {
    return res.status(400).json({ error: "signedXdr, assetCode, issuer, target required" });
  }

  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET);
    const adminKey = tx.source;
    const key = voteKey(assetCode, issuer, target);

    if (!voteStore.has(key)) {
      voteStore.set(key, { assetCode, issuer, target, voters: new Set() });
    }
    const bucket = voteStore.get(key)!;
    bucket.voters.add(adminKey);
    const votes = bucket.voters.size;

    if (votes >= QUORUM) {
      const result = await server.submitTransaction(
        StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET) as any
      );
      voteStore.delete(key);
      return res.json({ status: "executed", votes, hash: result.hash });
    }

    return res.json({ status: "vote_recorded", votes, quorum: QUORUM });
  } catch (e: any) {
    if (e.response?.data?.extras?.result_codes?.transaction === "tx_bad_auth") {
      return res.status(403).json({ error: "UnauthorizedFreezeAttempt" });
    }
    return res.status(500).json({ error: e.message });
  }
});
