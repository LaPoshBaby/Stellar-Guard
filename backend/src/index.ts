import "dotenv/config";
import express from "express";
import cors from "cors";
import { transfersRouter } from "./routes/transfers";
import { freezeRouter } from "./routes/freeze";
import { horizonMonitor } from "./services/horizonMonitor";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/transfers", transfersRouter);
app.use("/api/freeze", freezeRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Only bind port and start monitor when run directly (not during tests)
if (require.main === module) {
  const PORT = process.env.PORT ?? 4000;
  app.listen(PORT, () => {
    console.log(`Stellar-Guard backend on :${PORT}`);
    horizonMonitor.start();
  });
}

export default app;
