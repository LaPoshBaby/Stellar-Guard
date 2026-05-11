"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SUSPICIOUS_THRESHOLD = 1_000_000;

interface Transfer { id: string; from: string; to: string; amount: number; asset: string; ts: string; }

interface Props { onSuspicious: (msg: string) => void; }

export function LedgerExplorer({ onSuspicious }: Props) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  // Stable ref so the callback never triggers the useEffect dependency
  const onSuspiciousRef = useRef(onSuspicious);
  useEffect(() => { onSuspiciousRef.current = onSuspicious; });

  useEffect(() => {
    async function poll() {
      try {
        const { data } = await axios.get<Transfer[]>(`${API}/api/transfers`);
        setTransfers(data);
        const suspicious = data.filter((t) => t.amount >= SUSPICIOUS_THRESHOLD);
        if (suspicious.length) onSuspiciousRef.current(`⚠️ ${suspicious.length} high-volume transfer(s) detected`);
      } catch {
        // NetworkTimeout — silently retry
      } finally { setLoading(false); }
    }
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []); // empty deps — runs once, uses stable ref for callback

  const chartData = transfers.slice(-20).map((t) => ({ ts: t.ts.slice(11, 16), amount: t.amount }));

  return (
    <div className="bg-stellar-card rounded-xl p-4 space-y-4">
      <h2 className="font-semibold text-lg">📡 Live Ledger Explorer</h2>
      {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="ts" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip />
              <Line type="monotone" dataKey="amount" stroke="#7c3aed" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-1">Asset</th><th className="text-left py-1">From</th>
                <th className="text-left py-1">To</th><th className="text-right py-1">Amount</th>
              </tr></thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className={`border-b border-gray-800 ${t.amount >= SUSPICIOUS_THRESHOLD ? "text-stellar-danger" : ""}`}>
                    <td className="py-1">{t.asset}</td>
                    <td className="py-1 font-mono">{t.from.slice(0, 8)}…</td>
                    <td className="py-1 font-mono">{t.to.slice(0, 8)}…</td>
                    <td className="py-1 text-right">{t.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
