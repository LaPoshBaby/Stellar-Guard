"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { signTransaction } from "@stellar/freighter-api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ASSET_CODE_RE = /^[A-Z0-9]{1,12}$/;
const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

interface Props { adminKey: string | null; onError: (msg: string) => void; }
type FreezeStatus = "idle" | "pending" | "success" | "error";

interface Proposal {
  assetCode: string;
  issuer: string;
  target: string;
  votes: number;
  expiresAt: string;
}

/** Returns a human-readable countdown string, e.g. "4d 12h" or "23h 5m". */
export function formatCountdown(expiresAt: string, now = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function FreezePanel({ adminKey, onError }: Props) {
  const [assetCode, setAssetCode] = useState("");
  const [issuer, setIssuer] = useState("");
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<FreezeStatus>("idle");
  const [votes, setVotes] = useState<number | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    async function fetchProposals() {
      try {
        const { data } = await axios.get<Proposal[]>(`${API}/api/freeze/proposals`);
        setProposals(data);
      } catch { /* non-fatal */ }
    }
    fetchProposals();
  }, [status]); // re-fetch after each vote

  async function submitVote() {
    if (!adminKey) { onError("Connect wallet first"); return; }
    if (!ASSET_CODE_RE.test(assetCode)) { onError("Asset code must be 1–12 uppercase letters/digits"); return; }
    if (!STELLAR_ADDR_RE.test(issuer)) { onError("Invalid issuer address"); return; }
    if (!STELLAR_ADDR_RE.test(target)) { onError("Invalid target address"); return; }

    setStatus("pending");
    try {
      const { data } = await axios.post(`${API}/api/freeze/build`, { assetCode, issuer, target, adminKey });
      const signedTransaction = await signTransaction(data.xdr, { network: "TESTNET" });
      const result = await axios.post(`${API}/api/freeze/submit`, { signedXdr: signedTransaction, assetCode, issuer, target });
      setVotes(result.data.votes);
      // issue #17: clear form on success
      setAssetCode("");
      setIssuer("");
      setTarget("");
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

  const now = new Date();

  return (
    <div className="bg-gray-100 dark:bg-stellar-card rounded-xl p-4 space-y-4">
      <h2 className="font-semibold text-lg">🔒 Freeze Governance</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">Sign as Admin to vote for a Quorum Freeze (CAP-0077)</p>

      <input value={assetCode} onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
        placeholder="Asset Code (e.g. RWAUSD, max 12 chars)"
        maxLength={12}
        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-transparent rounded px-3 py-2 text-sm" />
      <input value={issuer} onChange={(e) => setIssuer(e.target.value)}
        placeholder="Issuer Account (G...)"
        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-transparent rounded px-3 py-2 text-sm font-mono" />
      <input value={target} onChange={(e) => setTarget(e.target.value)}
        placeholder="Target Account to Freeze (G...)"
        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-transparent rounded px-3 py-2 text-sm font-mono" />

      <button onClick={submitVote} disabled={status === "pending" || !adminKey}
        className="w-full bg-stellar-danger hover:opacity-90 disabled:opacity-40 text-white py-2 rounded font-semibold text-sm">
        {status === "pending" ? "Signing…" : "Vote to Freeze"}
      </button>

      {status === "success" && (
        <p className="text-stellar-safe text-sm">✅ Vote submitted! ({votes}/3 admins approved)</p>
      )}

      {proposals.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-300 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Active Proposals</p>
          {proposals.map((p) => {
            const countdown = formatCountdown(p.expiresAt, now);
            const expiringSoon = new Date(p.expiresAt).getTime() - now.getTime() < 24 * 60 * 60 * 1000;
            return (
              <div key={`${p.assetCode}:${p.target}`}
                className={`rounded-lg px-3 py-2 text-xs space-y-1 ${expiringSoon ? "bg-stellar-danger/20 border border-stellar-danger" : "bg-white dark:bg-gray-800"}`}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{p.assetCode}</span>
                  <span className={expiringSoon ? "text-stellar-danger font-semibold" : "text-gray-500 dark:text-gray-400"}>
                    ⏱ {countdown}
                  </span>
                </div>
                <div className="text-gray-500 dark:text-gray-400 font-mono truncate">{p.target}</div>
                <div className="text-gray-400 dark:text-gray-500">{p.votes}/3 votes</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
