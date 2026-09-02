/**
 * GujRaksha (ગુજ રક્ષા) — Central Worker Node Orchestrator & Camera Dispatcher
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Full Worker Lifecycle:
 * - ONLINE (Standby / Scanning)
 * - OFFLINE (Automatic detection when heartbeat stops > 10s)
 * - RECOVERED (Automatic reconnection when worker comes back online)
 */

import cameraService from "./cameraService.js";
import anprStore from "../db/anprStore.js";
import watchlistStore from "../db/watchlistStore.js";

class WorkerOrchestratorService {
  constructor() {
    this.workers = new Map(); // worker_id -> WorkerState
    this.HEARTBEAT_TIMEOUT_MS = 10000; // 10 seconds without heartbeat = OFFLINE
    this.initWatchdog();
  }

  /**
   * Helper to get target plates for workers.
   */
  getTargetWatchlist() {
    return watchlistStore.getAll().map(w => ({
      id: w.id,
      vehicle_plate: w.vehicle_plate,
      category: w.category,
      fir_number: w.fir_number,
      police_station: w.police_station,
      priority: w.priority
    }));
  }

  /**
   * Rebalance camera assignments across all online auto-assigned worker nodes.
   * Rules:
   * 1. Strict Sequential Filling: Worker 1 (node-1) is filled up to max_capacity (100) FIRST.
   * 2. Standby Buffer: Worker 2 receives 0 cameras (STANDBY) until total cameras exceed Worker 1's capacity.
   * 3. Exclusive Assignment: Zero duplicate cameras across worker nodes.
   * 4. Automatic Failover: If a worker goes OFFLINE, its cameras immediately reassign to the next online worker.
   */
  rebalanceClusterAllocation() {
    const allCamsResult = cameraService.getCameras({ limit: 100000 });
    const allCams = allCamsResult.cameras || [];

    // Filter cameras with active AI detection
    const aiCams = allCams.filter(c => {
      const mode = String(c.detection_mode || "").toUpperCase();
      return mode === "OBJECT_DETECTION" || 
             mode === "AI_OBJECT_DETECTION" ||
             mode === "ANPR_DETECTION" || 
             mode === "ANPR" ||
             mode === "TRAFFIC_MONITORING";
    });

    // Get all online workers in deterministic registration order
    const autoWorkers = Array.from(this.workers.values())
      .filter(w => w.status === "ONLINE" && !w.is_manually_assigned)
      .sort((a, b) => (new Date(a.registered_at || 0).getTime()) - (new Date(b.registered_at || 0).getTime()));

    let camCursor = 0;
    const totalEligible = aiCams.length;

    for (const worker of autoWorkers) {
      const capacity = worker.max_capacity || 100;
      
      let poolForWorker = aiCams;
      if (worker.district && worker.district.toLowerCase() !== "all") {
        poolForWorker = aiCams.filter(c => String(c.district || "").toLowerCase() === worker.district.toLowerCase());
      }

      if (camCursor < poolForWorker.length) {
        const remaining = poolForWorker.length - camCursor;
        const takeCount = Math.min(capacity, remaining);
        const assignedSlice = poolForWorker.slice(camCursor, camCursor + takeCount);
        camCursor += assignedSlice.length;

        worker.assigned_cameras = assignedSlice.map(c => ({
          id: c.id,
          camera_code: c.camera_code || c.code || `CAM-${c.id}`,
          name: c.name || `Camera ${c.id}`,
          district: c.district || worker.district || "All",
          detection_mode: c.detection_mode || "ANPR_DETECTION",
          rtsp_url: c.rtsp_url || c.stream_url || c.url || "0",
          latitude: c.latitude,
          longitude: c.longitude
        }));
      } else {
        // Node 1 took all available cameras; this node sits in STANDBY buffer
        worker.assigned_cameras = [];
      }

      worker.state = worker.assigned_cameras.length > 0 ? "SCANNING" : "STANDBY";
      if (worker.stats) {
        worker.stats.active_streams = worker.assigned_cameras.length;
      }
    }
  }

  /**
   * Register worker and assign cameras according to sequential cluster policy.
   */
  registerWorker({ worker_id, hostname = "worker-node", district = "All", max_capacity = 100, hardware = "CPU" }) {
    if (!worker_id) {
      worker_id = `node-${Date.now().toString(36).slice(-4)}`;
    }

    const existing = this.workers.get(worker_id);
    const isReconnecting = existing && existing.status === "OFFLINE";
    const capacity = Math.max(1, parseInt(max_capacity) || 100);

    const workerRecord = {
      worker_id,
      hostname,
      district: district || "All",
      max_capacity: capacity,
      hardware,
      status: "ONLINE",
      state: "STANDBY",
      registered_at: existing?.registered_at || new Date().toISOString(),
      last_seen: Date.now(),
      assigned_cameras: existing?.is_manually_assigned ? (existing.assigned_cameras || []) : [],
      is_manually_assigned: existing?.is_manually_assigned || false,
      stats: {
        fps: 0,
        active_streams: 0,
        total_detections: existing?.stats?.total_detections || 0,
        cpu_load: "Low",
        memory_usage: "Normal"
      }
    };

    this.workers.set(worker_id, workerRecord);

    // Rebalance all auto-assigned workers sequentially
    this.rebalanceClusterAllocation();

    const assigned = workerRecord.assigned_cameras || [];
    const logMsg = isReconnecting
      ? `🟢 [Worker Orchestrator] Worker \x1b[32m${worker_id}\x1b[0m RECONNECTED (Assigned: ${assigned.length} cameras, State: ${workerRecord.state})`
      : `📡 [Worker Orchestrator] Worker \x1b[36m${worker_id}\x1b[0m (${hostname}) registered ➔ Assigned \x1b[32m${assigned.length} Cameras\x1b[0m (State: \x1b[33m${workerRecord.state}\x1b[0m | Max Capacity: ${capacity})`;
    
    console.log(logMsg);
    if (assigned.length > 0) {
      const sampleCodes = assigned.slice(0, 8).map(c => `${c.camera_code} (${c.district})`).join(', ');
      const moreMsg = assigned.length > 8 ? ` ... and ${assigned.length - 8} more` : '';
      console.log(`   📹 \x1b[33m[Assigned Cams]:\x1b[0m ${sampleCodes}${moreMsg}`);
    } else {
      console.log(`   ⏳ \x1b[33m[Cluster Standby]:\x1b[0m Node waiting for primary node to reach 100 cameras or camera volume expansion.`);
    }

    // Broadcast live SSE update to CCC Dashboard
    try {
      anprStore.broadcastAlert({
        type: "WORKER_STATUS_CHANGED",
        worker_id,
        status: "ONLINE",
        state: workerRecord.state,
        assigned_count: assigned.length,
        timestamp: new Date().toISOString()
      });
    } catch (_) {}

    return workerRecord;
  }

  /**
   * Handle incoming heartbeat from Python worker.
   * If a previously OFFLINE worker calls heartbeat, it automatically recovers to ONLINE.
   */
  heartbeat(worker_id, stats = {}) {
    let worker = this.workers.get(worker_id);
    let justRecovered = false;

    if (!worker) {
      worker = this.registerWorker({ worker_id, ...stats });
    } else if (worker.status === "OFFLINE") {
      worker.status = "ONLINE";
      justRecovered = true;
      console.log(`🟢 [Worker Orchestrator] Worker \x1b[32m${worker_id}\x1b[0m resumed sending heartbeats. Status: ONLINE`);
    }

    worker.last_seen = Date.now();

    // Rebalance sequential allocation
    if (!worker.is_manually_assigned) {
      this.rebalanceClusterAllocation();
    }

    worker.state = worker.assigned_cameras.length > 0 ? "SCANNING" : "STANDBY";
    if (stats) {
      worker.stats = {
        ...worker.stats,
        ...stats,
        active_streams: worker.assigned_cameras.length
      };
    }

    if (justRecovered) {
      try {
        anprStore.broadcastAlert({
          type: "WORKER_STATUS_CHANGED",
          worker_id,
          status: "ONLINE",
          state: worker.state,
          assigned_count: worker.assigned_cameras.length,
          timestamp: new Date().toISOString()
        });
      } catch (_) {}
    }

    return {
      success: true,
      worker_id: worker.worker_id,
      status: worker.status,
      state: worker.state,
      assigned_count: worker.assigned_cameras.length,
      assigned_cameras: worker.assigned_cameras,
      watchlist: this.getTargetWatchlist()
    };
  }


  /**
   * Central Admin explicitly assigns cameras to a specific worker node.
   * Prioritizes ANPR-enabled and traffic surveillance cameras.
   */
  assignCamerasToWorker(worker_id, { camera_ids = [], count = null, district = null, anpr_only = true }) {
    const worker = this.workers.get(worker_id);
    if (!worker) {
      return { success: false, message: `Worker ${worker_id} not found.` };
    }

    if (worker.status === "OFFLINE") {
      return { success: false, message: `Worker ${worker_id} is currently OFFLINE. Cannot assign cameras.` };
    }

    const allCamsResult = cameraService.getCameras({ limit: 100000 });
    let allCams = allCamsResult.cameras || [];

    if (district && district.toLowerCase() !== "all") {
      allCams = allCams.filter(c => String(c.district || "").toLowerCase() === district.toLowerCase());
    }

    // Filter & prioritize AI cameras (Object Detection, ANPR) for AI Workers
    let candidateCams = allCams;
    if (anpr_only !== false) {
      const aiCams = allCams.filter(c => {
        const mode = String(c.detection_mode || "").toUpperCase();
        return mode === "OBJECT_DETECTION" || 
               mode === "AI_OBJECT_DETECTION" ||
               mode === "ANPR_DETECTION" || 
               mode === "ANPR";
      });
      candidateCams = aiCams;
    }

    let selectedCams = [];
    if (camera_ids && camera_ids.length > 0) {
      const idSet = new Set(camera_ids.map(String));
      selectedCams = allCams.filter(c => idSet.has(String(c.id)) || idSet.has(String(c.camera_code)));
    } else if (count) {
      const maxToTake = Math.min(parseInt(count) || 100, worker.max_capacity);
      selectedCams = candidateCams.slice(0, maxToTake);
    } else {
      selectedCams = candidateCams.slice(0, worker.max_capacity);
    }

    worker.assigned_cameras = selectedCams.map(c => ({
      id: c.id,
      camera_code: c.camera_code || c.code || `CAM-${c.id}`,
      name: c.name || `Camera ${c.id}`,
      district: c.district || worker.district,
      detection_mode: c.detection_mode || "OBJECT_DETECTION",
      rtsp_url: c.rtsp_url || c.stream_url || c.url || "0",
      latitude: c.latitude,
      longitude: c.longitude
    }));

    worker.is_manually_assigned = true;
    worker.state = worker.assigned_cameras.length > 0 ? "SCANNING" : "STANDBY";
    worker.stats.active_streams = worker.assigned_cameras.length;

    console.log(`🎯 [Worker Orchestrator] Central Admin assigned ${worker.assigned_cameras.length} AI vision cameras to \x1b[36m${worker_id}\x1b[0m!`);

    return {
      success: true,
      worker_id: worker.worker_id,
      state: worker.state,
      assigned_count: worker.assigned_cameras.length,
      assigned_cameras: worker.assigned_cameras
    };
  }

  /**
   * Central Admin revokes/stops all cameras on a worker node (returns worker to STANDBY).
   */
  clearWorkerCameras(worker_id) {
    const worker = this.workers.get(worker_id);
    if (!worker) {
      return { success: false, message: `Worker ${worker_id} not found.` };
    }
    worker.assigned_cameras = [];
    worker.is_manually_assigned = true;
    worker.state = "STANDBY";
    worker.stats.active_streams = 0;
    console.log(`⏹️ [Worker Orchestrator] Cleared all cameras from \x1b[36m${worker_id}\x1b[0m (Returned to STANDBY).`);
    return { success: true, worker_id, state: "STANDBY" };
  }

  /**
   * Distribute all AI cameras evenly across all currently ONLINE workers.
   */
  autoDistributeAllWorkers(district = null, anpr_only = true) {
    const onlineWorkers = Array.from(this.workers.values()).filter(w => w.status === "ONLINE");

    if (onlineWorkers.length === 0) {
      return { success: false, message: "No online workers connected to Central CCC." };
    }

    const allCamsResult = cameraService.getCameras({ limit: 100000 });
    let allCams = allCamsResult.cameras || [];
    if (district && district.toLowerCase() !== "all") {
      allCams = allCams.filter(c => String(c.district || "").toLowerCase() === district.toLowerCase());
    }

    // Filter for all AI-enabled cameras (OBJECT_DETECTION or ANPR_DETECTION)
    if (anpr_only !== false) {
      const aiCams = allCams.filter(c => {
        const mode = String(c.detection_mode || "").toUpperCase();
        return mode === "OBJECT_DETECTION" || 
               mode === "AI_OBJECT_DETECTION" ||
               mode === "ANPR_DETECTION" || 
               mode === "ANPR";
      });
      allCams = aiCams;
    }

    onlineWorkers.forEach(w => { 
      w.assigned_cameras = []; 
      w.is_manually_assigned = false;
    });

    allCams.forEach((c, idx) => {
      const targetWorker = onlineWorkers[idx % onlineWorkers.length];
      if (targetWorker.assigned_cameras.length < targetWorker.max_capacity) {
        targetWorker.assigned_cameras.push({
          id: c.id,
          camera_code: c.camera_code || c.code || `CAM-${c.id}`,
          name: c.name || `Camera ${c.id}`,
          district: c.district || targetWorker.district,
          detection_mode: c.detection_mode || "OBJECT_DETECTION",
          rtsp_url: c.rtsp_url || c.stream_url || c.url || "0",
          latitude: c.latitude,
          longitude: c.longitude
        });
      }
    });

    onlineWorkers.forEach(w => {
      w.state = w.assigned_cameras.length > 0 ? "SCANNING" : "STANDBY";
      w.stats.active_streams = w.assigned_cameras.length;
    });

    console.log(`⚖️ [Worker Orchestrator] Central auto-distributed ${allCams.length} ANPR cameras across ${onlineWorkers.length} workers.`);

    return {
      success: true,
      total_cameras: allCams.length,
      online_workers: onlineWorkers.length,
      distribution: onlineWorkers.map(w => ({
        worker_id: w.worker_id,
        state: w.state,
        assigned_count: w.assigned_cameras.length,
        max_capacity: w.max_capacity
      }))
    };
  }

  /**
   * Get all registered workers and summary telemetry.
   */
  getAllWorkers() {
    const list = Array.from(this.workers.values());
    const totalCamerasAssigned = list.reduce((acc, w) => acc + (w.status === "ONLINE" ? w.assigned_cameras.length : 0), 0);
    const onlineCount = list.filter(w => w.status === "ONLINE").length;

    return {
      total_workers: list.length,
      online_workers: onlineCount,
      total_cameras_assigned: totalCamerasAssigned,
      workers: list
    };
  }

  /**
   * Watchdog: Runs every 3 seconds.
   * If a worker does not ping heartbeat for > 10 seconds -> Marks OFFLINE immediately!
   * Automatically rebalances cameras to surviving online nodes.
   */
  initWatchdog() {
    setInterval(() => {
      const now = Date.now();
      let stateChanged = false;

      for (const [id, worker] of this.workers.entries()) {
        if (worker.status === "ONLINE" && (now - worker.last_seen > this.HEARTBEAT_TIMEOUT_MS)) {
          console.warn(`🔴 [Worker Watchdog Alert] Worker \x1b[31m${id}\x1b[0m missed heartbeats for > 10s. Marked as \x1b[41m\x1b[1mOFFLINE\x1b[0m.`);
          worker.status = "OFFLINE";
          worker.state = "OFFLINE";
          worker.stats.active_streams = 0;
          stateChanged = true;

          // Broadcast real-time RED offline alert to UI
          try {
            anprStore.broadcastAlert({
              type: "WORKER_STATUS_CHANGED",
              worker_id: id,
              status: "OFFLINE",
              state: "OFFLINE",
              timestamp: new Date().toISOString()
            });
          } catch (_) {}
        }
      }

      if (stateChanged) {
        this.rebalanceClusterAllocation();
      }
    }, 3000);
  }

}

const workerOrchestrator = new WorkerOrchestratorService();
export default workerOrchestrator;
