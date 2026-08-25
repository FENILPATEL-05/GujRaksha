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
  X
} from "lucide-react";
import { WatchlistManagerPage } from "./WatchlistManagerPage";

export const ANPRIntelligencePage = ({
  onTrackVehicleOnMap,
  onOpenAddWatchlist,
  onCameraSelect,
  cameras = [],
  addToast
}) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("gujraksha_anpr_tab") || "detections"); // "detections" or "watchlist"
  const [detections, setDetections] = useState([]);
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

  const [scannerConfig, setScannerConfig] = useState(null);
  const [isSweeping, setIsSweeping] = useState(false);

  const fetchScannerConfig = async () => {
    try {
      const res = await fetch("/api/v1/anpr/scanner-config");
      const json = await res.json();
      if (json.success) setScannerConfig(json.data);
    } catch (e) {}
  };

  const handleUpdateScannerConfig = async (updates) => {
    try {
      const res = await fetch("/api/v1/anpr/scanner-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (json.success) {
        setScannerConfig(json.data);
        if (addToast) addToast(`ANPR Scanner config updated! Frequency: ${json.data.scanIntervalMs}ms`, "success", "Scanner Config Updated");
      }
    } catch (e) {}
  };

  const handleTriggerFullSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await fetch("/api/v1/anpr/run-engine-all", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        fetchDetections();
        if (addToast) addToast("⚡ Native C++ ANPR inference completed across all platform cameras!", "success", "Multi-Camera Sweep Done");
      }
    } catch (e) {
    } finally {
      setIsSweeping(false);
    }
  };

  useEffect(() => {
    fetchDetections();
    fetchScannerConfig();
    
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
      fetchScannerConfig();
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
        </div>
      </div>

      {activeTab === "watchlist" ? (
        <WatchlistManagerPage
          onOpenAddWatchlist={onOpenAddWatchlist}
          onTrackVehicleOnMap={onTrackVehicleOnMap}
          addToast={addToast}
        />
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
              {scannerConfig && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", background: "rgba(15, 23, 42, 0.6)", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--panel-border)" }}>
                  {/* Auto-Scan Status Toggle */}
                  <button
                    className="btn btn-sm"
                    onClick={() => handleUpdateScannerConfig({ autoScanEnabled: !scannerConfig.autoScanEnabled })}
                    style={{
                      height: "28px",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "0 9px",
                      gap: "5px",
                      background: scannerConfig.autoScanEnabled ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: scannerConfig.autoScanEnabled ? "#4ade80" : "#f87171",
                      borderColor: scannerConfig.autoScanEnabled ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"
                    }}
                    title="Click to toggle automatic background ANPR scanner"
                  >
                    <Radio size={12} className={scannerConfig.autoScanEnabled ? "animate-pulse" : ""} />
                    {scannerConfig.autoScanEnabled ? "AUTO-SCAN ACTIVE" : "SCANNER PAUSED"}
                  </button>

                  {/* Dynamic Frequency Adjuster */}
                  <select
                    value={scannerConfig.scanIntervalMs}
                    onChange={(e) => handleUpdateScannerConfig({ scanIntervalMs: Number(e.target.value) })}
                    style={{
                      height: "28px",
                      background: "var(--input-bg)",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      borderRadius: "6px",
                      padding: "0 6px",
                      fontWeight: 600
                    }}
                    title="Dynamically adjust multi-camera scan frequency"
                  >
                    <option value={1500}>1.5s Interval</option>
                    <option value={3000}>3.0s Interval</option>
                    <option value={5000}>5.0s Interval</option>
                    <option value={10000}>10.0s Interval</option>
                  </select>

                  {/* Mode Adjuster */}
                  <select
                    value={scannerConfig.mode}
                    onChange={(e) => handleUpdateScannerConfig({ mode: e.target.value })}
                    style={{
                      height: "28px",
                      background: "var(--input-bg)",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      borderRadius: "6px",
                      padding: "0 6px",
                      fontWeight: 600
                    }}
                    title="Select ANPR Detection Engine Mode"
                  >
                    <option value="HYBRID_AUTO">Hybrid Auto (OCR + C++)</option>
                    <option value="CPP_ENGINE">Native C++ Engine</option>
                    <option value="STREAM_OCR">Stream OCR Vision</option>
                  </select>
                </div>
              )}

              <button
                className="btn btn-sm btn-primary"
                onClick={handleTriggerFullSweep}
                disabled={isSweeping}
                style={{ height: "36px", padding: "0 12px", gap: "6px", fontSize: "11.5px" }}
                title="Manually trigger immediate ANPR sweep across all platform cameras"
              >
                <Play size={13} fill="currentColor" /> {isSweeping ? "Sweeping All Cameras..." : "Sweep All Cameras"}
              </button>

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
                  <th>Vehicle Details</th>
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
                    return (
                      <tr key={det.id} style={{ background: isHit ? "rgba(244,63,94,0.06)" : "transparent" }}>
                        <td>
                          <div className="vehicle-plate-box" style={{ margin: "2px 0" }}>
                            <span className="plate-flag">IND</span>
                            <span className="plate-number">{det.vehicle_plate}</span>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>{det.vehicle_type}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Color: {det.vehicle_color || "Standard"} · Speed: {det.speed_kmh} km/h</div>
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

