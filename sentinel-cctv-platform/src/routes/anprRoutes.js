import express from "express";
import anprStore from "../db/anprStore.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET all detection events
router.get("/detections", authenticateToken, (req, res, next) => {
  try {
    const filters = {
      is_watchlist: req.query.is_watchlist,
      district: req.query.district,
      search: req.query.search
    };
    const records = anprStore.getAll(filters);
    const totalWatchlist = records.filter(r => r.is_watchlist_hit).length;
    res.json({
      success: true,
      total: records.length,
      data: {
        detections: records,
        totalWatchlist: totalWatchlist
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET active real-time alerts
router.get("/alerts", authenticateToken, (req, res, next) => {
  try {
    const alerts = anprStore.getActiveAlerts();
    res.json({
      success: true,
      total: alerts.length,
      data: alerts
    });
  } catch (err) {
    next(err);
  }
});

// GET live alert stream via Server-Sent Events (SSE)
router.get("/alerts/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "Real-time alert dispatch connected" })}\n\n`);

  anprStore.subscribeAlerts(res);
});

// GET trajectory for vehicle plate (GIS Route reconstruction)
router.get("/trajectory/:plate", authenticateToken, (req, res, next) => {
  try {
    const trajectory = anprStore.getTrajectoryForPlate(req.params.plate);
    res.json({
      success: true,
      data: trajectory
    });
  } catch (err) {
    next(err);
  }
});

// POST Ingestion Endpoint for AI Team Pipeline
router.post("/ingest", (req, res, next) => {
  try {
    const detection = anprStore.ingest(req.body);
    res.status(201).json({
      success: true,
      message: detection.is_watchlist_hit
        ? "🚨 WATCHLIST HIT: Real-time alert dispatched to Command Center!"
        : "ANPR Detection event logged successfully.",
      isWatchlistHit: detection.is_watchlist_hit,
      data: detection
    });
  } catch (err) {
    next(err);
  }
});

export default router;
