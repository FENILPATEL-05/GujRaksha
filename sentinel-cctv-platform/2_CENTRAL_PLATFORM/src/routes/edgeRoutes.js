/**
 * GujRaksha (ગુજ રક્ષા) — Distributed District Edge Gateway Protocol
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Manages remote district edge server registration, heartbeat monitoring,
 * and high-concurrency batch telemetry ingestion.
 */

import express from 'express';
import anprStore from '../db/anprStore.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// In-memory state for registered district edge nodes
const registeredEdgeNodes = new Map();

// POST Register Remote District Edge Node
router.post('/register', (req, res, next) => {
  try {
    const { node_id, district, node_name, active_cameras, gpu_hardware, ip_address } = req.body;
    if (!node_id || !district) {
      return res.status(400).json({
        success: false,
        message: "node_id and district are mandatory parameters."
      });
    }

    const nodeRecord = {
      node_id,
      node_name: node_name || `Edge Cluster Node [${district}]`,
      district,
      active_cameras: active_cameras || 0,
      gpu_hardware: gpu_hardware || "NVIDIA CUDA / TensorRT Node",
      ip_address: ip_address || req.ip,
      status: "ONLINE",
      last_heartbeat: new Date().toISOString(),
      registered_at: new Date().toISOString()
    };

    registeredEdgeNodes.set(node_id, nodeRecord);

    console.log(`🌐 \x1b[36m[District Edge Gateway]\x1b[0m Node Registered: \x1b[1m${node_id}\x1b[0m (${district}) — ${active_cameras} camera stream(s) active.`);

    res.status(201).json({
      success: true,
      message: `District Edge Node '${node_id}' successfully registered with GujRaksha Command Center.`,
      data: nodeRecord
    });
  } catch (err) {
    next(err);
  }
});

// POST Batch Telemetry Sync from District Edge Node
router.post('/sync', async (req, res, next) => {
  try {
    const { node_id, district, detections, telemetry } = req.body;
    if (node_id && registeredEdgeNodes.has(node_id)) {
      const node = registeredEdgeNodes.get(node_id);
      node.last_heartbeat = new Date().toISOString();
      if (telemetry && telemetry.active_cameras) {
        node.active_cameras = telemetry.active_cameras;
      }
      registeredEdgeNodes.set(node_id, node);
    }

    const items = Array.isArray(detections) ? detections : [];
    const result = await anprStore.ingestBatch(items);

    res.status(200).json({
      success: true,
      message: `District Edge Sync Complete: Ingested ${result.count} telemetry event(s).`,
      count: result.count,
      node_status: "ACTIVE"
    });
  } catch (err) {
    next(err);
  }
});

// GET List Active District Edge Nodes
router.get('/nodes', authenticateToken, (req, res, next) => {
  try {
    const nodes = Array.from(registeredEdgeNodes.values());
    res.json({
      success: true,
      total_nodes: nodes.length,
      data: nodes
    });
  } catch (err) {
    next(err);
  }
});

export default router;
