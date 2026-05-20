"use client";
import { useState } from "react";
import axios from "axios";
import { signTransaction } from "@stellar/freighter-api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ASSET_CODE_RE = /^[A-Z0-9]{1,12}$/;
const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

interface Props { adminKey: string | null; onError: (msg: string) => void; }
type FreezeStatus = "idle" | "pending" | "success" | "error";

export function FreezePanel({ adminKey, onError }: Props) {
  const [assetCode, setAssetCode] = useState("");
  const [issuer, setIssuer] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<FreezeStatus>("idle");
  const [votes, setVotes] = useState<number | null>(null);

  async function submitVote() {
    if (!adminKey) { onError("Connect wallet first"); return; }
    if (!ASSET_CODE_RE.test(assetCode)) { onError("Asset code must be 1–12 uppercase letters/digits"); return; }
    if (!STELLAR_ADDR_RE.test(issuer)) { onError("Invalid issuer address"); return; }
    if (!STELLAR_ADDR_RE.test(target)) { onError("Invalid target address"); return; }

    setStatus("pending");
    try {
      const { data } = await axios.post(`${API}/api/freeze/build`, { assetCode, issuer, target, adminKey });
      const { signedTransaction, error: signError } = await signTransaction(data.xdr, { network: "TESTNET" });
      if (signError) throw new Error(signError);
      const result = await axios.post(`${API}/api/freeze/submit`, { signedXdr: signedTransaction, assetCode, issuer, target });
      setVotes(result.data.votes);
      setStatus("success");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = e.response?.data?.error ?? e.message ?? "Unknown error";
      if (msg.includes("ContractNotFound")) onError("Contract not deployed on testnet");
      else if (msg.includes("Unauthorized")) onError("UnauthorizedFreezeAttempt: not an admin");
      else if (msg.includes("timeout") || msg.includes("ECONNREFUSED")) onError("NetworkTimeout: backend unreachable");
      else onError(msg);
      setStatus("error");
    }
  }

  return (
    <div className="bg-stellar-card rounded-xl p-4 space-y-4">
      <h2 className="font-semibold text-lg">🔒 Freeze Governance</h2>
      <p className="text-xs text-gray-400">Sign as Admin to vote for a Quorum Freeze (CAP-0077)</p>

      <input value={assetCode} onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
        placeholder="Asset Code (e.g. RWAUSD, max 12 chars)"
        maxLength={12}
        className="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
      <input value={issuer} onChange={(e) => setIssuer(e.target.value)}
        placeholder="Issuer Account (G...)"
        className="w-full bg-gray-800 rounded px-3 py-2 text-sm font-mono" />
      <input value={target} onChange={(e) => setTarget(e.target.value)}
        placeholder="Target Account to Freeze (G...)"
        className="w-full bg-gray-800 rounded px-3 py-2 text-sm font-mono" />

      <button onClick={submitVote} disabled={status === "pending" || !adminKey}
        className="w-full bg-stellar-danger hover:opacity-90 disabled:opacity-40 text-white py-2 rounded font-semibold text-sm">
        {status === "pending" ? "Signing…" : "Vote to Freeze"}
      </button>

      {status === "success" && (
        <p className="text-stellar-safe text-sm">✅ Vote submitted! ({votes}/3 admins approved)</p>
      )}
    </div>
  );
}
