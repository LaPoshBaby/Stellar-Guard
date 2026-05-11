import StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export interface Transfer {
  id: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  ts: string;
}

// In-memory ring buffer (last 200 transfers)
const transfers: Transfer[] = [];
const MAX = 200;

function push(t: Transfer) {
  transfers.push(t);
  if (transfers.length > MAX) transfers.shift();
}

function start() {
  server
    .payments()
    .cursor("now")
    .stream({
      onmessage: (payment: any) => {
        if (payment.type !== "payment") return;
        push({
          id: payment.id,
          from: payment.from,
          to: payment.to,
          amount: parseFloat(payment.amount),
          asset: payment.asset_type === "native" ? "XLM" : payment.asset_code,
          ts: payment.created_at,
        });
      },
      onerror: (err: Error) => {
        console.error("[HorizonMonitor] stream error:", err.message);
      },
    });
  console.log("[HorizonMonitor] streaming payments from Horizon testnet");
}

export const horizonMonitor = { start, getTransfers: () => [...transfers] };
