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
  Activity
} from "lucide-react";
import { WatchlistManagerPage } from "./WatchlistManagerPage";

export const ANPRIntelligencePage = ({
  onTrackVehicleOnMap,
  onOpenAddWatchlist,
  onCameraSelect,
  cameras = [],
  addToast
}) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("gujraksha_anpr_tab") || "detections"); // "detections", "watchlist", or "edge_nodes"
  const [detections, setDetections] = useState([]);
  const [edgeNodes, setEdgeNodes] = useState([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchPlate, setSearchPlate] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem("gujraksha_anpr_tab", activeTab);
  }, [activeTab]);

  const fetchEdgeNodes = async () => {
    try {
      const res = await fetch("/api/v1/edge/nodes");
      const json = await res.json();
      if (json.success) {
        setEdgeNodes(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching edge nodes:", err);
    }
  };

  useEffect(() => {
    fetchEdgeNodes();
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
        setWatchlistCount(json.data?.totalWatchlist !== undefined ? json.data.totalWatchlist : list.filter(d => d.is_watchlist_hit).length);
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
  const watchlistHits = detections.filter(d => d.is_watchlist_hit).length;
  const activeFilterCount = selectedDistrict !== "ALL" ? 1 : 0;
  const anprCamerasCount = cameras.filter(c => {
    const mode = (c.detection_mode || '').toUpperCase();
    return mode === 'ANPR_DETECTION' || mode === 'ANPR';
  }).length;

  return (
    <div className="table-view">
      {/* Sub-Header Tabs - ALWAYS VISIBLE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <Car size={20} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            ANPR & Watchlist
          </h2>
        </div>

        <div className="view-switcher" style={{ background: "var(--input-bg)", padding: "4px", borderRadius: "10px" }}>
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
        </div>
      </div>

      {activeTab === "watchlist" ? (
        <WatchlistManagerPage
          onOpenAddWatchlist={onOpenAddWatchlist}
          onTrackVehicleOnMap={onTrackVehicleOnMap}
          addToast={addToast}
        />
      ) : activeTab === "edge_nodes" ? (
        <div className="table-wrap" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={18} style={{ color: "var(--accent)" }} /> Distributed District Edge Nodes Cluster
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-dim)" }}>
                Real-time telemetry and health monitoring across Gujarat district edge AI processing servers.
              </p>
            </div>
            <button className="btn btn-sm" onClick={fetchEdgeNodes} style={{ gap: "6px" }}>
              <RefreshCw size={12} /> Refresh Cluster Status
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Node Identifier</th>
                <th>District Location</th>
                <th>Active Cameras</th>
                <th>GPU Acceleration</th>
                <th>Cluster Status</th>
                <th>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {edgeNodes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                    <Server size={32} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>No Remote District Edge Nodes Registered Yet</div>
                    <div style={{ fontSize: "11.5px", marginTop: "4px" }}>District Edge servers register via <code>POST /api/v1/edge/register</code> protocol endpoint.</div>
                  </td>
                </tr>
              ) : (
                edgeNodes.map((node) => (
                  <tr key={node.node_id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{node.node_id}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{node.node_name}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{node.district}</td>
                    <td>
                      <span className="badge" style={{ background: "rgba(34, 211, 238, 0.15)", color: "var(--accent)", fontWeight: 700 }}>
                        📹 {node.active_cameras} Active RTSP Feeds
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "11.5px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Cpu size={12} style={{ color: "#a855f7" }} /> {node.gpu_hardware}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                        ● ONLINE
                      </span>
                    </td>
                    <td style={{ fontSize: "11.5px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {new Date(node.last_heartbeat).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                  <th>Target Number Plate</th>
                  <th>Vehicle Details & Attributes</th>
                  <th>Spotted CCTV Camera & Location</th>
                  <th>District</th>
                  <th>FIR / Crime Case Details</th>
                  <th>Spotted Timestamp</th>
                  <th style={{ textAlign: "right" }}>Route Trajectory</th>
                </tr>
              </thead>
              <tbody>
                {detections.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                      <FolderOpen size={38} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>No suspect vehicles spotted yet.</div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>When a watchlist target passes through any Gujarat CCTV camera, it will automatically appear here with real-time alerts.</div>
                    </td>
                  </tr>
                ) : (
                  detections.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((det) => {
                    const isHit = !!det.is_watchlist_hit;
                    const isSpeeding = det.is_speeding || (det.speed_kmh > 80);
                    const colorHex = det.vehicle_color === "Red" ? "#ef4444" : det.vehicle_color === "Blue" ? "#3b82f6" : det.vehicle_color === "Yellow" ? "#eab308" : det.vehicle_color === "Green" ? "#22c55e" : det.vehicle_color === "White" ? "#f8fafc" : det.vehicle_color === "Black" ? "#475569" : "#cbd5e1";

                    return (
                      <tr key={det.id} style={{ background: isHit ? "rgba(244,63,94,0.06)" : "transparent" }}>
                        <td>
                          <div className="vehicle-plate-box" style={{ margin: "2px 0" }}>
                            <span className="plate-flag">IND</span>
                            <span className="plate-number">{det.vehicle_plate}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                              <Car size={13} style={{ color: "var(--accent)" }} />
                              {det.vehicle_type || "Sedan / Car"}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(30, 41, 59, 0.6)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: colorHex, display: "inline-block" }} />
                                <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{det.vehicle_color || "Silver"}</span>
                              </span>

                              {isSpeeding ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  <Zap size={10} /> {det.speed_kmh} km/h (SPEEDING)
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-dim)" }}>
                                  Speed: {det.speed_kmh} km/h
                                </span>
                              )}
                            </div>
                          </div>
                        </td>


                        <td>
                          <div className="cell-name">{det.camera_name}</div>
                          <div className="cell-id">{det.camera_code || det.camera_id}</div>
                        </td>

                        <td style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                          {det.district}
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div>
                              {isHit ? (
                                <span className="threat-severity-badge critical" style={{ fontSize: "10px", padding: "2px 7px", display: "inline-flex" }}>
                                  🚨 {det.watchlist_category ? det.watchlist_category.replace("_", " ") : "WATCHLIST HIT"}
                                </span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: "10px", padding: "2px 7px", display: "inline-flex", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                                  ✓ VERIFIED VEHICLE
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                              {isHit ? (det.watchlist_fir || "Police Case Record") : `AI Confidence: ${det.confidence || 98.5}%`}
                            </div>
                            {det.watchlist_ps && (
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                📍 {det.watchlist_ps}
                              </div>
                            )}
                          </div>
                        </td>

                        <td style={{ fontSize: "11.5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                          <b>{new Date(det.timestamp).toLocaleTimeString()}</b>
                          <div style={{ fontSize: "10.5px", color: "var(--text-dim)" }}>{new Date(det.timestamp).toLocaleDateString()}</div>
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
            <div className="table-pagination-footer" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", marginTop: "10px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, detections.length)} of {detections.length} intercepts
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  className="btn btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "0 8px" }}>
                  Page {currentPage} of {Math.ceil(detections.length / itemsPerPage)}
                </span>
                <button
                  className="btn btn-sm"
                  disabled={currentPage === Math.ceil(detections.length / itemsPerPage)}
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(detections.length / itemsPerPage), p + 1))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

