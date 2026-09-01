import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  Maximize2,
  Minimize2,
  Video,
  Radio,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Camera,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Sparkles
} from "lucide-react";
import { LiveCCTVFeed } from "./LiveCCTVFeed";

export const VideoWallPage = ({
  cameras = [],
  departments = [],
  onCameraSelect,
  addToast
}) => {
  const [gridMode, setGridMode] = useState(() => localStorage.getItem("gujraksha_videowall_grid") || "2x2"); // "1x1", "2x2", "3x3"
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    localStorage.setItem("gujraksha_videowall_grid", gridMode);
  }, [gridMode]);

  // Filter cameras
  const filteredCameras = cameras.filter(c => {
    const matchDept = selectedDept === "ALL" || (c.department_id || "").toUpperCase() === selectedDept.toUpperCase();
    const matchDistrict = selectedDistrict === "ALL" || (c.district || "").toLowerCase() === selectedDistrict.toLowerCase();
    return matchDept && matchDistrict;
  });

  const getPageSize = () => {
    if (gridMode === "1x1") return 1;
    if (gridMode === "2x2") return 4;
    if (gridMode === "3x3") return 9;
    return 4;
  };

  const pageSize = getPageSize();
  const totalPages = Math.ceil(filteredCameras.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const activeCameras = filteredCameras.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [gridMode, selectedDept, selectedDistrict]);

  return (
    <div className="table-view" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", padding: "16px 20px", overflow: "hidden" }}>
      {/* Top Video Wall Header & Controls Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <LayoutGrid size={20} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            Video Wall
          </h2>
        </div>

        {/* Right Toolbar Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Department Filter */}
          <select
            className="filter-select"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px" }}
          >
            <option value="ALL">All Departments ({departments.length || "26+"})</option>
            {departments.map(d => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>

          {/* District Filter */}
          <select
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px" }}
          >
            <option value="ALL">All Districts</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Gandhinagar">Gandhinagar</option>
            <option value="Surat">Surat</option>
            <option value="Rajkot">Rajkot</option>
            <option value="Vadodara">Vadodara</option>
            <option value="Junagadh">Junagadh</option>
            <option value="Kutch">Kutch</option>
          </select>

          {/* Grid Layout Switcher */}
          <div className="view-switcher" style={{ background: "var(--input-bg)", padding: "3px", borderRadius: "8px" }}>
            <button
              className={gridMode === "1x1" ? "active" : ""}
              onClick={() => setGridMode("1x1")}
              title="1x1 Single Focus"
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              1×1 Focus
            </button>
            <button
              className={gridMode === "2x2" ? "active" : ""}
              onClick={() => setGridMode("2x2")}
              title="2x2 Quad Grid"
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              2×2 Quad
            </button>
            <button
              className={gridMode === "3x3" ? "active" : ""}
              onClick={() => setGridMode("3x3")}
              title="3x3 9-Cam Matrix"
              style={{ fontSize: "11px", padding: "4px 8px" }}
            >
              3×3 Matrix
            </button>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                className="btn btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={13} />
              </button>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {currentPage}/{totalPages}
              </span>
              <button
                className="btn btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Video Wall Matrix Grid Container */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns:
            gridMode === "1x1" ? "1fr" : gridMode === "2x2" ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gridTemplateRows:
            gridMode === "1x1" ? "1fr" : gridMode === "2x2" ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: "10px",
          minHeight: 0,
          background: "var(--bg)",
          borderRadius: "12px",
          border: "1px solid var(--panel-border)",
          padding: "10px"
        }}
      >
        {activeCameras.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
            <Video size={48} strokeWidth={1.4} style={{ color: "var(--accent)", marginBottom: "12px" }} />
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>No cameras available in this filter layout.</div>
          </div>
        ) : (
          activeCameras.map((cam, idx) => {
            return (
              <div
                key={cam.id}
                style={{
                  background: "var(--panel-bg)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid var(--panel-border)",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3)"
                }}
              >
                {/* 1. Top Card Header (OUTSIDE Video Stream) */}
                <div
                  style={{
                    padding: "6px 10px",
                    background: "var(--panel-bg-solid)",
                    borderBottom: "1px solid var(--panel-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                    <span className="dot active" style={{ width: "6px", height: "6px", flexShrink: 0 }}></span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                      {cam.name}
                    </span>
                    <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--accent)", flexShrink: 0 }}>
                      ({cam.camera_code || cam.id})
                    </span>
                  </div>

                  <span style={{ fontSize: "9.5px", background: "var(--input-bg)", color: "var(--text-secondary)", padding: "1px 6px", borderRadius: "4px", border: "1px solid var(--panel-border)", flexShrink: 0 }}>
                    {cam.district || "Gujarat"}
                  </span>
                </div>

                {/* 2. Middle Pure Video Stream (100% Clear & Unobstructed) */}
                <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", minHeight: 0 }}>
                  <LiveCCTVFeed camera={cam} isMuted={isMuted} />
                </div>

                {/* 3. Bottom Card Footer Controls (OUTSIDE Video Stream) */}
                <div
                  style={{
                    padding: "5px 10px",
                    background: "var(--panel-bg-solid)",
                    borderTop: "1px solid var(--panel-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {cam.camera_type || "ANPR_SPECIAL"}
                  </div>

                  <div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onCameraSelect(cam)}
                      title="Inspect in Single HD Player with PTZ"
                      style={{ padding: "2px 10px", fontSize: "10.5px", gap: "4px" }}
                    >
                      <Maximize2 size={11} /> Inspect HD
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

