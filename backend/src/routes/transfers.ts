import { Router } from "express";
import { horizonMonitor } from "../services/horizonMonitor";

export const transfersRouter = Router();

// GET /api/transfers — returns recent payment stream
transfersRouter.get("/", (_req, res) => {
  res.json(horizonMonitor.getTransfers());
});

// GET /api/transfers/asset/:code — filter by asset code
transfersRouter.get("/asset/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const filtered = horizonMonitor.getTransfers().filter((t) => t.asset === code);
  res.json(filtered);
});
