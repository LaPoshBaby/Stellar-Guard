import { Router, Request, Response } from "express";
import StellarSdk from "@stellar/stellar-sdk";

export const freezeRouter = Router();

const HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const CONTRACT_ID = process.env.FREEZE_CONTRACT_ID ?? "";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// In-memory vote store: contractKey -> Set of admin public keys
const voteStore = new Map<string, Set<string>>();
const QUORUM = 3;

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
    // Build a Soroban invoke_host_function transaction for freeze_entry
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "vote_freeze",
          StellarSdk.xdr.ScVal.scvString(assetCode),
          StellarSdk.xdr.ScVal.scvString(issuer),
          StellarSdk.xdr.ScVal.scvString(target)
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
  const { signedXdr } = req.body;
  if (!signedXdr) return res.status(400).json({ error: "signedXdr required" });

  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET);
    const adminKey = tx.source;

    // Derive vote key from first operation args (simplified)
    const voteKey = `${CONTRACT_ID}`;
    if (!voteStore.has(voteKey)) voteStore.set(voteKey, new Set());
    voteStore.get(voteKey)!.add(adminKey);
    const votes = voteStore.get(voteKey)!.size;

    if (votes >= QUORUM) {
      // Submit to network when quorum reached
      const result = await server.submitTransaction(
        StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET) as any
      );
      voteStore.delete(voteKey);
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
