"use client";
import { useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { LedgerExplorer } from "@/components/LedgerExplorer";
import { FreezePanel } from "@/components/FreezePanel";
import { AlertBanner } from "@/components/AlertBanner";

export default function CommandCenter() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stellar-accent">⚡ Stellar-Guard</h1>
          <p className="text-sm text-gray-400">CAP-0077 Quorum Freeze Command Center</p>
        </div>
        <WalletConnect onConnect={setPublicKey} />
      </header>

      {alert && <AlertBanner message={alert} onDismiss={() => setAlert(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LedgerExplorer onSuspicious={(msg) => setAlert(msg)} />
        </div>
        <div>
          <FreezePanel adminKey={publicKey} onError={(msg) => setAlert(msg)} />
        </div>
      </div>
    </main>
  );
}
