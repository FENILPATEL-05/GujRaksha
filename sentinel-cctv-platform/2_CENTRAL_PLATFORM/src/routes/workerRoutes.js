/**
 * GujRaksha (ગુજ રક્ષા) — Worker Node Orchestrator REST Routes
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 */

import express from "express";
import workerOrchestrator from "../services/workerOrchestratorService.js";

const router = express.Router();

// POST Register Worker Node (Called when Python script boots up)
router.post("/register", (req, res, next) => {
  try {
    const { worker_id, hostname, district, max_capacity, hardware } = req.body;
    const worker = workerOrchestrator.registerWorker({
      worker_id,
      hostname,
      district,
      max_capacity,
      hardware
    });
    res.json({
      success: true,
      message: `Worker node ${worker.worker_id} connected in STANDBY mode.`,
      data: worker
    });
  } catch (err) {
    next(err);
  }
});

// POST Worker Heartbeat & Dynamic Camera Fetch (Called every 2-3s by Python worker)
router.post("/heartbeat", (req, res, next) => {
  try {
    const { worker_id, stats } = req.body;
    if (!worker_id) {
      return res.status(400).json({ success: false, message: "worker_id is required." });
    }
    const result = workerOrchestrator.heartbeat(worker_id, stats);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET All Connected Worker Nodes (For Central Dashboard UI)
router.get("/", (req, res, next) => {
  try {
    const result = workerOrchestrator.getAllWorkers();
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST Central Admin assigns cameras to a worker (e.g. 50 cameras, or specific IDs)
router.post("/:id/assign", (req, res, next) => {
  try {
    const workerId = req.params.id;
    const { camera_ids, count, district } = req.body || {};
    const result = workerOrchestrator.assignCamerasToWorker(workerId, { camera_ids, count, district });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST Central Admin stops/clears cameras on a worker (returns worker to STANDBY)
router.post("/:id/clear", (req, res, next) => {
  try {
    const workerId = req.params.id;
    const result = workerOrchestrator.clearWorkerCameras(workerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST Central Admin 1-Click Auto-Distribute all cameras across connected workers
router.post("/auto-distribute", (req, res, next) => {
  try {
    const { district } = req.body || {};
    const result = workerOrchestrator.autoDistributeAllWorkers(district);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE Deregister / Remove Worker Node from Central CCC
router.delete("/:id", (req, res, next) => {
  try {
    const workerId = req.params.id;
    const result = workerOrchestrator.deleteWorker(workerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;


