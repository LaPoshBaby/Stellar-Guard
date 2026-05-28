"use client";
import { useEffect, useState } from "react";
import { getNetworkDetails } from "@stellar/freighter-api";

const APP_NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "TESTNET").toUpperCase();

type NetworkState = "unknown" | "TESTNET" | "PUBLIC" | string;

export function NetworkBadge() {
  const [network, setNetwork] = useState<NetworkState>("unknown");

  useEffect(() => {
    getNetworkDetails()
      .then((d) => setNetwork((d.network ?? "").toUpperCase()))
      .catch(() => setNetwork("unknown"));
  }, []);

  if (network === "unknown") return null;

  const mismatch = network !== APP_NETWORK;
  const label = network === "PUBLIC" ? "MAINNET" : network;

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        data-testid="network-badge"
        className={`text-xs font-bold px-2 py-0.5 rounded ${
          network === "TESTNET"
            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
            : "bg-green-500/20 text-green-400 border border-green-500"
        }`}
      >
        {label}
      </span>
      {mismatch && (
        <span
          data-testid="network-mismatch-warning"
          className="text-xs text-stellar-danger font-semibold"
        >
          ⚠️ Freighter is on {label} but app expects {APP_NETWORK}
        </span>
      )}
    </div>
  );
}
