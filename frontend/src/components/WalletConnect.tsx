"use client";
import { useState } from "react";
import { getPublicKey, isConnected } from "@stellar/freighter-api";

interface Props { onConnect: (key: string) => void; }

export function WalletConnect({ onConnect }: Props) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    try {
      const connected = await isConnected();
      if (!connected) { setError("Freighter not installed"); return; }
      const pk = await getPublicKey();
      setKey(pk);
      onConnect(pk);
    } catch (e: any) {
      setError(e.message ?? "Wallet connection failed");
    }
  }

  if (key) return (
    <div className="bg-stellar-card border border-stellar-accent rounded px-3 py-1 text-xs font-mono text-stellar-accent">
      {key.slice(0, 6)}…{key.slice(-4)}
    </div>
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={connect} className="bg-stellar-accent hover:opacity-90 text-white px-4 py-2 rounded text-sm font-semibold">
        Connect Freighter
      </button>
      {error && <span className="text-stellar-danger text-xs">{error}</span>}
    </div>
  );
}
