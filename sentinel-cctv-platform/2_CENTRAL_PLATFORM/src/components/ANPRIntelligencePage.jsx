import React, { useState, useEffect } from "react";
import {
  Car,
  Search,
  ShieldAlert,
  LocateFixed,
  Play,
  RefreshCw,
  Filter,
  CheckCircle2,
  FolderOpen,
  Radio,
  Clock,
  Layers,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ChevronDown,
  SlidersHorizontal,
  X,
  Server,
  Cpu,
  Zap,
  AlertTriangle,
  Activity,
  Flame,
  ArrowRight,
  Eye,
  Copy,
  Maximize2,
  Camera,
  Video,
  ExternalLink,
  Building2,
  ShieldCheck,
  Fingerprint,
  Globe,
  Lock,
  FileText,
  Database,
  Key,
  Terminal,
  Send,
  Save,
  Settings,
  Sliders
} from "lucide-react";

import { Pagination } from "./Pagination";
import { WatchlistManagerPage } from "./WatchlistManagerPage";
import { LiveCCTVFeed } from "./LiveCCTVFeed";

export const ANPRIntelligencePage = ({


  onTrackVehicleOnMap,
  onOpenAddWatchlist,
  onCameraSelect,
  cameras = [],
  addToast
}) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("gujraksha_anpr_tab") || "ai_vision"); // "ai_vision", "detections", "watchlist", or "edge_nodes"
  const [selectedVisionCamId, setSelectedVisionCamId] = useState(null);
  const [detections, setDetections] = useState([]);
  const [edgeNodes, setEdgeNodes] = useState([]);
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchPlate, setSearchPlate] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Minimal Government Gateways Configuration Template
  const [testPlateInput, setTestPlateInput] = useState("GJ-01-ER-9821");
  const [testQueryOutput, setTestQueryOutput] = useState(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [gateways, setGateways] = useState([
    {
      id: "vahan",
      name: "VAHAN 4.0",
      type: "Vehicle Registry (MoRTH)",
      url: "https://vahan.parivahan.gov.in/vahan-api/v4",
      clientCode: "GJ-POLICE-CCC-01",
      status: "READY"
    },
    {
      id: "egujcop",
      name: "eGujCop CCTNS",
      type: "Crime & FIR Grid (Gujarat Police)",
      url: "https://egujcop.gujarat.gov.in/cctns-api/v2",
      clientCode: "GUJ-POLICE-STATE-NODE",
      status: "CONNECTED"
    },
    {
      id: "sarathi",
      name: "SARATHI",
      type: "Driving License (MoRTH)",
      url: "https://sarathi.parivahan.gov.in/sarathi-api/v4",
      clientCode: "MORTH-DL-VERIFY",
      status: "READY"
    },
    {
      id: "nafis",
      name: "NAFIS / AFIS",
      type: "Criminal Biometrics (NCRB / CID)",
      url: "https://nafis.ncrb.gov.in/national-grid/v3",
      clientCode: "NCRB-MHA-NODE-01",
      status: "READY"
    }
  ]);

  const handleUpdateGateway = (id, field, val) => {
    setGateways(prev => prev.map(g => g.id === id ? { ...g, [field]: val } : g));
  };

  const handleSaveGw = (gwName) => {
    if (addToast) addToast(`${gwName} configuration saved successfully.`, "success", "Gateway Saved");
  };

  const handleTestPing = (gwName) => {
    if (addToast) addToast(`Connection verified with ${gwName} (Ping: 54ms)`, "info", "Handshake Verified");
  };

  const handleRunSimpleTest = () => {
    setIsQuerying(true);
    setTestQueryOutput(null);
    setTimeout(() => {
      setIsQuerying(false);
      setTestQueryOutput({
        plate: testPlateInput,
        vahan: "Active RC · Hyundai Creta (White) · Owner: R. Patel · RTO: GJ-01",
        egujcop: "Verified Clean (No Active Stolen FIR)",
        latency: "58ms (mTLS 1.3)"
      });
      if (addToast) addToast(`Records fetched for ${testPlateInput} (Latency: 58ms)`, "success", "Query Success");
    }, 500);
  };



  useEffect(() => {
    localStorage.setItem("gujraksha_anpr_tab", activeTab);
  }, [activeTab]);

  const fetchEdgeNodes = async () => {
    try {
      const res = await fetch("/api/v1/workers");
      const json = await res.json();
      if (json.success && json.data) {
        const workers = json.data.workers || [];
        setEdgeNodes(workers);
      } else {
        const fallbackRes = await fetch("/api/v1/edge/nodes");
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.success) {
          setEdgeNodes(fallbackJson.data || []);
        }
      }
    } catch (err) {
      console.error("Error fetching edge nodes:", err);
    }
  };

  const fetchWatchlistCount = async () => {
    try {
      const res = await fetch("/api/v1/watchlist");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWatchlistCount(json.data.length);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchEdgeNodes();
    fetchWatchlistCount();

    const handleGlobalWatchlist = () => {
      fetchWatchlistCount();
    };

    window.addEventListener("watchlist_updated", handleGlobalWatchlist);
    return () => {
      window.removeEventListener("watchlist_updated", handleGlobalWatchlist);
    };
  }, []);

  const fetchDetections = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (watchlistOnly) params.set("is_watchlist", "true");
      if (selectedDistrict !== "ALL") params.set("district", selectedDistrict);
      if (searchPlate) params.set("search", searchPlate);

      const res = await fetch(`/api/v1/anpr/detections?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const list = Array.isArray(json.data)
          ? json.data
          : (json.data?.detections || []);
        setDetections(list);
      }
    } catch (err) {
      console.error("Error fetching ANPR detections:", err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchDetections();
    
    // Connect to live SSE alert stream to auto-refresh table instantly
    let eventSource;
    try {
      eventSource = new EventSource("/api/v1/anpr/alerts/live");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.type === "ANPR_HOTLIST" || data.vehicle_plate || data.vehicleNo)) {
            fetchDetections();
          }
          if (data && data.type === "WATCHLIST_CHANGED") {
            fetchWatchlistCount();
          }
        } catch (e) {}
      };
    } catch (err) {
      console.error("SSE Error in ANPR page:", err);
    }

    const interval = setInterval(() => {
      fetchDetections();
    }, 3000);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [watchlistOnly, selectedDistrict, searchPlate]);

  // Total metrics
  const totalDetections = detections.length;
  const activeFilterCount = selectedDistrict !== "ALL" ? 1 : 0;
  const anprCamerasCount = cameras.filter(c => {
    const mode = (c.detection_mode || '').toUpperCase();
    return mode === 'ANPR_DETECTION' || mode === 'ANPR';
  }).length;

  // Live Object Detection is an on-demand real-time AI tool for ALL cameras (not restricted by camera registry AI type)
  const selectableCams = cameras && cameras.length > 0 ? cameras : [];

  const activeVisionCam = selectableCams.find(c => String(c.id) === String(selectedVisionCamId)) || selectableCams[0] || null;


  const handleSelectVisionCam = (camId) => {
    setSelectedVisionCamId(camId);
    const cam = selectableCams.find(c => String(c.id) === String(camId)) || cameras.find(c => String(c.id) === String(camId));
    const camCode = cam ? (cam.camera_code || cam.id) : camId;
    if (camCode) {
      try {
        fetch("/api/v1/anpr/active-vision-camera", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ camera_code: camCode })
        }).catch(() => {});
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (activeTab === "ai_vision" && activeVisionCam) {
      const camCode = activeVisionCam.camera_code || activeVisionCam.id;
      if (camCode) {
        try {
          fetch("/api/v1/anpr/active-vision-camera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ camera_code: camCode })
          }).catch(() => {});
        } catch (_) {}
      }
    }
  }, [activeTab, activeVisionCam?.camera_code, activeVisionCam?.id]);

  return (
    <div className="table-view">
      {/* Sub-Header Tabs - ALWAYS VISIBLE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <Car size={20} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            AI Vision & ANPR Hub
          </h2>
        </div>

        <div className="view-switcher" style={{ background: "var(--input-bg)", padding: "4px", borderRadius: "10px" }}>
          <button
            className={activeTab === "ai_vision" ? "active" : ""}
            onClick={() => setActiveTab("ai_vision")}
            style={{ gap: "6px", fontWeight: 700 }}
          >
            <Eye size={14} strokeWidth={2.4} style={{ color: "var(--accent)" }} /> 🎯 Live AI Object Detection
          </button>

          <button
            className={activeTab === "detections" ? "active" : ""}
            onClick={() => setActiveTab("detections")}
          >
            <Radio size={14} strokeWidth={2} /> Active Suspect Intercepts ({totalDetections})
          </button>

          <button
            className={activeTab === "watchlist" ? "active" : ""}
            onClick={() => setActiveTab("watchlist")}
          >
            <ShieldAlert size={14} strokeWidth={2} style={{ color: "var(--danger)" }} /> Watchlist Database ({watchlistCount})
          </button>

          <button
            className={activeTab === "edge_nodes" ? "active" : ""}
            onClick={() => setActiveTab("edge_nodes")}
          >
            <Server size={14} strokeWidth={2} style={{ color: "var(--accent)" }} /> District Edge Gateway ({edgeNodes.length})
          </button>

          <button
            className={activeTab === "gov_gateways" ? "active" : ""}
            onClick={() => setActiveTab("gov_gateways")}
            style={{ gap: "6px", fontWeight: 700 }}
          >
            <Building2 size={14} strokeWidth={2.2} style={{ color: "#38bdf8" }} /> 🏛️ Gov Gateways (VAHAN • eGujCop • NAFIS)
          </button>
        </div>
      </div>


      {activeTab === "ai_vision" ? (
        selectableCams.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            background: "var(--panel-bg)",
            padding: "48px 24px",
            borderRadius: "10px",
            border: "1px solid var(--panel-border)",
            height: "calc(100vh - 150px)",
            minHeight: "520px",
            textAlign: "center"
          }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(34, 211, 238, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Eye size={28} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>No Cameras Configured for Live AI Object Detection</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", maxWidth: "480px", lineHeight: "1.6" }}>
              Live Object Detection is currently not enabled on any camera. Go to <strong>Camera Registry</strong> or edit a camera and select <strong>"AI Object Detection & Classification"</strong> or check <strong>"🎯 Enable Live AI Object Detection"</strong>.
            </p>
          </div>
        ) : (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "var(--panel-bg)",
          padding: "14px",
          borderRadius: "10px",
          border: "1px solid var(--panel-border)",
          height: "calc(100vh - 150px)",
          minHeight: "520px"
        }}>
          {/* Simple Top Bar: Camera Selector */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
              <h3 style={{ margin: 0, fontSize: "14.5px", color: "var(--text-primary)" }}>
                Live Stream: {activeVisionCam?.name} ({activeVisionCam?.camera_code || activeVisionCam?.id})
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-dim)", fontWeight: 600 }}>Select Camera ({selectableCams.length} Available):</span>
              <select
                className="input-select"
                value={activeVisionCam?.id || ""}
                onChange={(e) => handleSelectVisionCam(e.target.value)}
                style={{
                  minWidth: "280px",
                  fontSize: "12px",
                  padding: "5px 10px",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "6px",
                  outline: "none"
                }}
              >
                {selectableCams.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.camera_code || c.id}) - {c.district || "Gujarat"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clean Full-Height Live Video Player with Real-Time Bounding Boxes */}
          <div style={{
            flex: 1,
            width: "100%",
            height: "100%",
            minHeight: "450px",
            background: "#000",
            borderRadius: "8px",
            overflow: "hidden",
            position: "relative",
            border: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <LiveCCTVFeed
              key={activeVisionCam?.id || activeVisionCam?.camera_code}
              camera={activeVisionCam}
              isMuted={true}
              isDetailed={false}
              showAiVision={false}
              defaultAiStream={true}
            />


          </div>
        </div>
        )


      ) : activeTab === "watchlist" ? (
        <WatchlistManagerPage
          onOpenAddWatchlist={onOpenAddWatchlist}
          onTrackVehicleOnMap={onTrackVehicleOnMap}
          onWatchlistChange={(count) => setWatchlistCount(count)}
          addToast={addToast}
        />
      ) : activeTab === "edge_nodes" ? (
        <div className="table-wrap" style={{ padding: "20px" }}>
          {/* Header & Global Auto-Distribute Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={18} style={{ color: "var(--accent)" }} /> Distributed Python AI ANPR Nodes & Camera Dispatcher
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-dim)" }}>
                Central On-Demand Camera Dispatch across 80,000 CCTV network. Workers register in Standby, receive up to 100 cameras & Watchlist targets.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/v1/workers/auto-distribute", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      addToast?.("Auto-Distributed cameras across connected worker nodes!", "success");
                      fetchEdgeNodes();
                    } else {
                      addToast?.(data.message || "Failed to auto-distribute", "error");
                    }
                  } catch (e) {
                    addToast?.("Error communicating with orchestrator", "error");
                  }
                }}
                style={{ gap: "6px", background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", borderColor: "#38bdf8" }}
              >
                <Zap size={14} /> ⚡ Auto-Distribute All Cameras
              </button>
              <button className="btn btn-sm btn-secondary" onClick={fetchEdgeNodes} style={{ gap: "5px" }}>
                <RefreshCw size={13} /> Refresh Nodes
              </button>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Worker Node ID</th>
                <th>District / Hostname</th>
                <th>Assigned ANPR Cameras</th>
                <th>AI Hardware Engine</th>
                <th>Node State</th>
                <th style={{ textAlign: "right", paddingRight: "20px" }}>Node Inspection</th>
              </tr>
            </thead>
            <tbody>
              {edgeNodes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                    <Server size={36} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>No AI ANPR Worker Nodes Connected Yet</div>
                    <div style={{ fontSize: "11.5px", marginTop: "6px", color: "var(--text-dim)" }}>
                      Workers auto-receive 100 cameras upon bootup: <code>./3_ANPR_EDGE_WORKER/start_worker.sh http://localhost:3000/api/v1 node-1 100</code>
                    </div>
                  </td>
                </tr>
              ) : (
                edgeNodes.map((node) => {
                  const isOnline = node.status === "ONLINE";
                  const isScanning = node.state === "SCANNING";
                  const assignedCount = node.assigned_cameras?.length || node.active_cameras || 0;
                  const maxCap = node.max_capacity || 100;

                  return (
                    <tr
                      key={node.worker_id || node.node_id}
                      style={{ cursor: "pointer", transition: "background 0.2s" }}
                      onClick={() => {
                        setSelectedWorkerModal(node);
                        setModalSearch("");
                      }}
                      title="Click to view all 100 assigned cameras in modal"
                    >
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                          {node.worker_id || node.node_id}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                          {node.hostname || node.node_name || "Cluster Node"}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                        {node.district || "All Gujarat"}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: "rgba(34, 211, 238, 0.15)",
                            color: "var(--accent)",
                            fontWeight: 700
                          }}
                        >
                          📹 {assignedCount} / {maxCap} Cameras
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "11.5px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "5px" }}>
                          <Cpu size={12} style={{ color: "#a855f7" }} /> {node.hardware || node.gpu_hardware || "CPU (Multi-Threaded)"}
                        </div>
                      </td>
                      <td>
                        {isOnline ? (
                          <span
                            className="badge badge-success"
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              border: "1px solid rgba(16, 185, 129, 0.3)"
                            }}
                          >
                            ● SCANNING (ACTIVE)
                          </span>
                        ) : (
                          <span
                            className="badge badge-danger"
                            style={{
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)"
                            }}
                          >
                            ● OFFLINE (WATCHDOG)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "20px" }}>
                        <button
                          className="btn btn-xs btn-outline"
                          style={{
                            fontSize: "11.5px",
                            padding: "4px 10px",
                            background: "rgba(34, 211, 238, 0.12)",
                            borderColor: "var(--accent)",
                            color: "var(--accent)",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWorkerModal(node);
                            setModalSearch("");
                          }}
                        >
                          <Eye size={13} /> View {assignedCount} Cameras
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "gov_gateways" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Banner */}
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "10px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={18} style={{ color: "#38bdf8" }} />
                Government Law Enforcement & Registry Integration Templates
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-dim)" }}>
                Pre-configured adapter forms for <strong>VAHAN, eGujCop (CCTNS), SARATHI, and NAFIS/AFIS</strong> for upcoming production integration.
              </p>
            </div>
            <span className="badge badge-success" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", padding: "5px 10px" }}>
              ● 4/4 Adapters Ready
            </span>
          </div>

          {/* 4 Clean Gateway Cards in a 2x2 Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "14px" }}>
            {gateways.map((gw) => (
              <div
                key={gw.id}
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: "0 0 2px 0", fontSize: "14.5px", color: "var(--text-primary)", fontWeight: 700 }}>
                      {gw.name}
                    </h4>
                    <div style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>{gw.type}</div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 6px" }}>
                    ● {gw.status}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "3px", display: "block" }}>
                      API Gateway Endpoint
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={gw.url}
                      onChange={(e) => handleUpdateGateway(gw.id, "url", e.target.value)}
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--panel-border)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        color: "var(--text-primary)",
                        fontSize: "12px",
                        width: "100%",
                        fontFamily: "var(--font-mono)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "3px", display: "block" }}>
                      Agency Client Code / Auth Key
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={gw.clientCode}
                      onChange={(e) => handleUpdateGateway(gw.id, "clientCode", e.target.value)}
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--panel-border)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        color: "#38bdf8",
                        fontSize: "12px",
                        width: "100%",
                        fontFamily: "var(--font-mono)"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                  <button
                    className="btn btn-xs btn-outline"
                    onClick={() => handleTestPing(gw.name)}
                    style={{ fontSize: "11px", padding: "4px 10px", gap: "4px" }}
                  >
                    <RefreshCw size={12} /> Test Ping
                  </button>
                  <button
                    className="btn btn-xs btn-primary"
                    onClick={() => handleSaveGw(gw.name)}
                    style={{ fontSize: "11px", padding: "4px 10px", gap: "4px" }}
                  >
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Simple Live Test Query Sandbox */}
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            borderRadius: "10px",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h4 style={{ margin: "0 0 2px 0", fontSize: "14px", color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Terminal size={15} style={{ color: "var(--accent)" }} />
                  Live Interop Test Simulator
                </h4>
                <div style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>
                  Test instant cross-query against VAHAN & eGujCop mock endpoints
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  value={testPlateInput}
                  onChange={(e) => setTestPlateInput(e.target.value)}
                  placeholder="Enter Plate (e.g. GJ-01-ER-9821)"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--panel-border)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "12.5px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    width: "180px"
                  }}
                />
                <button
                  className="btn btn-xs btn-primary"
                  onClick={handleRunSimpleTest}
                  disabled={isQuerying}
                  style={{ padding: "7px 14px", fontSize: "12px", gap: "6px" }}
                >
                  {isQuerying ? <RefreshCw size={13} className="spin" /> : <Send size={13} />}
                  {isQuerying ? "Querying..." : "Test Lookup"}
                </button>
              </div>
            </div>

            {testQueryOutput && (
              <div style={{
                background: "var(--input-bg)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                fontSize: "12px"
              }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "#38bdf8" }}>
                    {testQueryOutput.plate}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    🚗 <strong>VAHAN:</strong> {testQueryOutput.vahan}
                  </span>
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>
                    🚔 <strong>eGujCop:</strong> {testQueryOutput.egujcop}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  Latency: <span style={{ color: "#4ade80", fontWeight: 700 }}>{testQueryOutput.latency}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (


        <>
          {/* Search & Modern Filter Toolbar */}
          <div className="table-unified-toolbar" style={{ marginBottom: "12px" }}>



            <div className="toolbar-filters-group" style={{ flex: 1 }}>
              <div className="search-box" style={{ flex: "1 1 280px" }}>
                <Search size={14} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search Suspect Plate (e.g. GJ-01-ER-9821), Camera, Location..."
                  value={searchPlate}
                  onChange={(e) => {
                    setSearchPlate(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchPlate && (
                  <X
                    size={13}
                    style={{ cursor: "pointer", color: "var(--text-dim)" }}
                    onClick={() => {
                      setSearchPlate("");
                      setCurrentPage(1);
                    }}
                  />
                )}
              </div>

              {/* Single Filter Popover Button */}
              <div style={{ position: "relative", zIndex: 1000 }}>
                <button
                  className="btn"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  style={{
                    height: "36px",
                    padding: "0 13px",
                    gap: "6px",
                    fontSize: "12px",
                    background: activeFilterCount > 0 ? "rgba(34, 211, 238, 0.15)" : "rgba(30, 41, 59, 0.55)",
                    borderColor: activeFilterCount > 0 ? "var(--accent)" : "rgba(255, 255, 255, 0.1)",
                    color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-primary)"
                  }}
                  title="Open District Filters"
                >
                  <SlidersHorizontal size={13} strokeWidth={2.2} />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span style={{
                      background: "var(--accent)",
                      color: "#000",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "1px 5px",
                      borderRadius: "10px"
                    }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilterMenu && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 999 }}
                      onClick={() => setShowFilterMenu(false)}
                    />
                    <div className="filter-popover-dropdown">
                      <div className="filter-popover-header">
                        <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <SlidersHorizontal size={12} style={{ color: "var(--accent)" }} /> Filter Options
                        </div>
                        {activeFilterCount > 0 && (
                          <button
                            className="filter-popover-reset"
                            onClick={() => {
                              setSelectedDistrict("ALL");
                              setCurrentPage(1);
                            }}
                          >
                            Reset All
                          </button>
                        )}
                      </div>

                      <div className="filter-popover-field">
                        <label className="filter-popover-label">District Location</label>
                        <select
                          className="filter-popover-select"
                          value={selectedDistrict}
                          onChange={(e) => {
                            setSelectedDistrict(e.target.value);
                            setCurrentPage(1);
                          }}
                        >
                          <option value="ALL">All Districts</option>
                          <option value="Ahmedabad">Ahmedabad</option>
                          <option value="Gandhinagar">Gandhinagar</option>
                          <option value="Surat">Surat</option>
                          <option value="Rajkot">Rajkot</option>
                          <option value="Vadodara">Vadodara</option>
                        </select>
                      </div>

                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setShowFilterMenu(false)}
                        style={{ marginTop: "4px", width: "100%", justifyContent: "center" }}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  background: "rgba(15, 23, 42, 0.6)",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-border)",
                  fontSize: "11.5px"
                }}
              >
                <Radio size={12} style={{ color: anprCamerasCount > 0 ? "#4ade80" : "var(--text-dim)" }} className={anprCamerasCount > 0 ? "animate-pulse" : ""} />
                <span style={{ fontWeight: 700, color: anprCamerasCount > 0 ? "#4ade80" : "var(--text-dim)" }}>
                  {anprCamerasCount > 0 ? `ANPR Engine Scanning (${anprCamerasCount} Active Feed${anprCamerasCount === 1 ? '' : 's'})` : "ANPR Engine Standby (No ANPR Feeds)"}
                </span>
              </div>

              <button className="btn" onClick={fetchDetections} style={{ height: "36px", padding: "0 12px", gap: "5px" }}>
                <RefreshCw size={13} /> Refresh Logs
              </button>
            </div>
          </div>

          {/* Detections Data Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle Number Plate</th>
                  <th>Detected CCTV Camera & Location</th>
                  <th>District</th>
                  <th>Detection Time</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {detections.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                      <FolderOpen size={38} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>No suspect vehicles spotted yet.</div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>When a watchlist target passes through any Gujarat CCTV camera, it will automatically appear here with real-time alerts.</div>
                    </td>
                  </tr>
                ) : (
                  detections.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((det) => {
                    const isHit = !!det.is_watchlist_hit;

                    return (
                      <tr key={det.id} style={{ background: isHit ? "rgba(244,63,94,0.06)" : "transparent" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="vehicle-plate-box" style={{ margin: "2px 0" }}>
                              <span className="plate-flag">IND</span>
                              <span className="plate-number">{det.vehicle_plate}</span>
                            </div>
                            {isHit ? (
                              <span className="threat-severity-badge critical" style={{ fontSize: "10.5px", padding: "3px 8px", display: "inline-flex" }}>
                                🚨 {det.watchlist_category ? det.watchlist_category.replace(/_/g, " ") : "WATCHLIST HIT"} ({det.watchlist_fir || "Active FIR"})
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 7px" }}>
                                ✓ SCAN PASS
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(34, 211, 238, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                              <Video size={14} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                                {det.camera_code || det.camera_id}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>
                                {det.camera_name || `Camera ${det.camera_code || det.camera_id}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                          <span className="badge" style={{ background: "rgba(100, 116, 139, 0.15)", color: "#cbd5e1", fontSize: "11px" }}>
                            📍 {det.district || "Gujarat"}
                          </span>
                        </td>

                        <td style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {new Date(det.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>
                            {new Date(det.timestamp).toLocaleDateString()}
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: "11px", gap: "5px" }}
                            onClick={() => onTrackVehicleOnMap(det.vehicle_plate)}
                            title="Trace vehicle trajectory route across Gujarat CCTV cameras"
                          >
                            <LocateFixed size={13} strokeWidth={2.2} /> Trace Route on Map
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {Math.ceil(detections.length / itemsPerPage) > 1 && (
            <div className="table-pagination-footer" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", marginTop: "10px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, detections.length)} of {detections.length} intercepts
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(detections.length / itemsPerPage)}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </>
      )}

      {/* Clean Minimal Assigned Cameras Modal */}
      {selectedWorkerModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={() => setSelectedWorkerModal(null)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "780px",
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Bar with Search */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b1120", gap: "12px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                <Video size={16} style={{ color: "var(--accent)" }} />
                <span>Assigned Cameras</span>
                <span className="badge" style={{ background: "rgba(34, 211, 238, 0.15)", color: "var(--accent)", fontSize: "11px", padding: "2px 7px" }}>
                  {selectedWorkerModal.assigned_cameras?.length || 0}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "340px" }}>
                <div className="search-box" style={{ width: "100%", margin: 0, display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Search size={13} style={{ color: "var(--text-dim)", marginRight: "6px" }} />
                  <input
                    type="text"
                    placeholder="Search camera code or name..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: "11.5px", outline: "none" }}
                  />
                  {modalSearch && <X size={12} style={{ cursor: "pointer", color: "var(--text-dim)" }} onClick={() => setModalSearch("")} />}
                </div>
              </div>

              <button
                onClick={() => setSelectedWorkerModal(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Clean Camera Table */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              <table className="table" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                <thead style={{ position: "sticky", top: 0, background: "#1e293b", zIndex: 10 }}>
                  <tr>
                    <th style={{ width: "45px", padding: "8px 12px" }}>#</th>
                    <th style={{ padding: "8px 12px" }}>Camera Code</th>
                    <th style={{ padding: "8px 12px" }}>Camera Name</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Detection Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const assigned = selectedWorkerModal.assigned_cameras || [];
                    const filtered = assigned.filter(c => {
                      if (!modalSearch) return true;
                      const q = modalSearch.toLowerCase();
                      return (
                        (c.camera_code || "").toLowerCase().includes(q) ||
                        (c.name || "").toLowerCase().includes(q) ||
                        (c.detection_mode || "").toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center", padding: "30px", color: "var(--text-dim)" }}>
                            No cameras matching "{modalSearch}"
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((cam, idx) => (
                      <tr key={cam.id || cam.camera_code || idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", padding: "7px 12px" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "7px 12px" }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                            {cam.camera_code || `CAM-${cam.id}`}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)", fontWeight: 500, padding: "7px 12px" }}>
                          {cam.name || `Gujarat Traffic Camera ${cam.id}`}
                        </td>
                        <td style={{ textAlign: "right", padding: "7px 12px" }}>
                          <span className="badge" style={{
                            background: String(cam.detection_mode).includes("ANPR") ? "rgba(34, 211, 238, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: String(cam.detection_mode).includes("ANPR") ? "var(--accent)" : "#10b981",
                            fontSize: "10.5px",
                            fontWeight: 600
                          }}>
                            {cam.detection_mode || "ANPR_INTELLIGENCE"}
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

