import express from "express";
import watchlistStore from "../db/watchlistStore.js";
import anprStore from "../db/anprStore.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET lightweight hotlist for AI Edge inference engine (Fast Sync)
router.get("/sync-hotlist", (req, res, next) => {
  try {
    const records = watchlistStore.getAll();
    const hotlistPlates = records.map(w => w.vehicle_plate.toUpperCase());
    const hotlistIndex = {};
    records.forEach(w => {
      hotlistIndex[w.vehicle_plate.toUpperCase()] = {
        id: w.id,
        category: w.category,
        fir_number: w.fir_number,
        police_station: w.police_station,
        priority: w.priority,
        vehicle_type: w.vehicle_type
      };
    });

    res.json({
      success: true,
      total_targets: records.length,
      plates: hotlistPlates,
      hotlist: hotlistIndex,
      last_updated: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// GET all watchlist records
router.get("/", authenticateToken, (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      priority: req.query.priority,
      search: req.query.search
    };
    const records = watchlistStore.getAll(filters);
    res.json({
      success: true,
      total: records.length,
      data: records
    });
  } catch (err) {
    next(err);
  }
});

// GET by vehicle plate
router.get("/check/:plate", authenticateToken, (req, res, next) => {
  try {
    const match = watchlistStore.getByPlate(req.params.plate);
    res.json({
      success: true,
      isMatch: !!match,
      data: match || null
    });
  } catch (err) {
    next(err);
  }
});

// POST add target to watchlist
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const created = await watchlistStore.create(req.body);

    // Broadcast live SSE update to all connected frontend clients
    try {
      anprStore.broadcastAlert({
        type: "WATCHLIST_CHANGED",
        action: "CREATED",
        target: created,
        total: watchlistStore.getAll().length,
        timestamp: new Date().toISOString()
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: "Target vehicle added to statewide police watchlist.",
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// PUT update target in watchlist
router.put("/:id", authenticateToken, async (req, res, next) => {
  try {
    const updated = await watchlistStore.update(req.params.id, req.body);

    // Broadcast live SSE update
    try {
      anprStore.broadcastAlert({
        type: "WATCHLIST_CHANGED",
        action: "UPDATED",
        target: updated,
        total: watchlistStore.getAll().length,
        timestamp: new Date().toISOString()
      });
    } catch (_) {}

    res.json({
      success: true,
      message: "Watchlist target updated successfully.",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE remove from watchlist
router.delete("/:id", authenticateToken, async (req, res, next) => {
  try {
    const deleted = await watchlistStore.delete(req.params.id);

    // Broadcast live SSE update
    try {
      anprStore.broadcastAlert({
        type: "WATCHLIST_CHANGED",
        action: "DELETED",
        target_id: req.params.id,
        total: watchlistStore.getAll().length,
        timestamp: new Date().toISOString()
      });
    } catch (_) {}

    res.json({
      success: true,
      message: "Target vehicle removed from watchlist.",
      data: deleted
    });
  } catch (err) {
    next(err);
  }
});

export default router;
