import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { ForensicVideoAnalyzer } from "./ForensicVideoAnalyzer";

export const ANPRIntelligencePage = ({


  onTrackVehicleOnMap,
  onOpenAddWatchlist,
  onCameraSelect,
  cameras = [],
  addToast
}) => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("gujraksha_anpr_tab") || "ai_vision"); // "ai_vision", "detections", "watchlist", or "edge_nodes"
  const [selectedVisionCamId, setSelectedVisionCamId] = useState(null);
  const [camSearchQuery, setCamSearchQuery] = useState("");
  const [isCamDropdownOpen, setIsCamDropdownOpen] = useState(false);
  const camDropdownRef = useRef(null);

  // Stream mode and filter controls for Live AI Vision tab
  const [isAiStreamActive, setIsAiStreamActive] = useState(false);
  const [enableObjDetection, setEnableObjDetection] = useState(true);
  const [enablePlateDetection, setEnablePlateDetection] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState({
    person: true,
    car: true,
    bike: true,
    truck_bus: true,
    other: true
  });


  const [detections, setDetections] = useState([]);
  const [edgeNodes, setEdgeNodes] = useState([]);
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null);
  const [selectedSnapshotDet, setSelectedSnapshotDet] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [watchlist, setWatchlist] = useState([]);

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchPlate, setSearchPlate] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");


  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [edgePage, setEdgePage] = useState(1);
  const [edgePerPage, setEdgePerPage] = useState(20);

  const [showFilterMenu, setShowFilterMenu] = useState(false);




  // Minimal Government Gateways Configuration Template
  const [testPlateInput, setTestPlateInput] = useState("GJ-01-ER-9821");
  const [testQueryOutput, setTestQueryOutput] = useState(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
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

  const handleRunSimpleTest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const rawPlate = (testPlateInput || "").trim().toUpperCase();
    if (!rawPlate) {
      if (addToast) addToast("Please enter a valid vehicle plate number.", "error", "Input Required");
      return;
    }

    setIsQuerying(true);
    setTestQueryOutput(null);

    const cleanPlate = rawPlate.replace(/[^A-Z0-9]/g, "");
    const formattedPlate = rawPlate.includes("-") 
      ? rawPlate 
      : (cleanPlate.length >= 8 ? `${cleanPlate.slice(0, 2)}-${cleanPlate.slice(2, 4)}-${cleanPlate.slice(4, 6)}-${cleanPlate.slice(6)}` : cleanPlate);

    let isWatchlistMatch = false;
    let watchlistInfo = null;

    try {
      const res = await fetch('/api/v1/watchlist');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const found = json.data.find(w => (w.vehicle_plate || '').replace(/[^A-Z0-9]/g, "") === cleanPlate);
        if (found) {
          isWatchlistMatch = true;
          watchlistInfo = found;
        }
      }
    } catch (_) {}

    setTimeout(() => {
      setIsQuerying(false);
      const outputData = {
        plate: rawPlate,
        formattedPlate: formattedPlate,
        isWatchlistMatch,
        watchlistInfo,
        vahan: {
          rcStatus: "ACTIVE (Valid)",
          ownerName: isWatchlistMatch ? (watchlistInfo?.owner_name || "Under Active Investigation") : "RAHUL M. PATEL",
          vehicleClass: isWatchlistMatch ? (watchlistInfo?.vehicle_type || "Commercial Transport / Sedan") : "Motor Car (LMV - Hyundai Creta 1.5 SX)",
          makerModel: "Hyundai Motor India / Creta 1.5L Petrol",
          fuelType: "Petrol / BS-VI OBD-II",
          registrationDate: "14-Mar-2023",
          vehicleAge: "3 Years 5 Months",
          rtoJurisdiction: `${rawPlate.slice(0, 5) || "GJ-01"} (Ahmedabad RTO - Subhash Bridge)`,
          insuranceValidity: "12-Mar-2027 (HDFC ERGO General Insurance)",
          pucValidity: "18-Nov-2026 (Valid)",
          fitnessValidity: "13-Mar-2038",
          chassisNumber: `MA3EFE0S0N${Math.floor(100000 + Math.random() * 900000)}`,
          engineNumber: `G4FLM${Math.floor(100000 + Math.random() * 900000)}`
        },
        egujcop: {
          crimeStatus: isWatchlistMatch ? "WANTED / ACTIVE POLICE FIR DETECTED" : "VERIFIED CLEAN (No Criminal Record)",
          firNumber: isWatchlistMatch ? (watchlistInfo?.fir_number || "FIR #502/2026") : "None",
          policeStation: isWatchlistMatch ? (watchlistInfo?.police_station || "SG Highway Police Station") : "None",
          crimeCategory: isWatchlistMatch ? (watchlistInfo?.category || "STOLEN_VEHICLE") : "Clear / Whitelisted",
          priority: isWatchlistMatch ? (watchlistInfo?.priority || "CRITICAL") : "NORMAL",
          seizureOrder: isWatchlistMatch ? "IMMEDIATE INTERCEPT & SEIZE" : "NO ACTIVE SEIZURE ORDER",
          lastSighting: isWatchlistMatch ? "Detected via S.G. Highway Junction CCTV" : "No Suspicious Incidents Reported"
        },
        network: {
          gateway: "MoRTH National VAHAN 4.0 & Gujarat State eGujCop CCTNS Grid",
          latency: "52ms",
          protocol: "REST API / mTLS 1.3 with SHA-256 HMAC Signature",
          clientNode: "GJ-POLICE-CCC-CENTRAL-01",
          queryTimestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        }
      };

      setTestQueryOutput({
        plate: rawPlate,
        vahan: `${outputData.vahan.rcStatus} · ${outputData.vahan.makerModel} · Owner: ${outputData.vahan.ownerName}`,
        egujcop: outputData.egujcop.crimeStatus,
        latency: "52ms (mTLS 1.3)"
      });
      setLookupResult(outputData);
      setIsLookupModalOpen(true);

      if (addToast) {
        addToast(
          isWatchlistMatch ? `🚨 Police Watchlist Match Found for ${rawPlate}!` : `Inter-Agency records verified for ${rawPlate} (Latency: 52ms)`,
          isWatchlistMatch ? "error" : "success",
          isWatchlistMatch ? "Wanted Hit" : "Lookup Complete"
        );
      }
    }, 450);
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
        setWatchlist(json.data);
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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchDetections();
    setTimeout(() => {
      setIsRefreshing(false);
      if (addToast) addToast("Vehicle passage logs refreshed.", "info", "Logs Refreshed");
    }, 600);
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

  // Filtered cameras for live AI selection (Max 50 items)
  const filteredVisionCams = useMemo(() => {
    const q = camSearchQuery.toLowerCase().trim();
    if (!q) {
      return selectableCams.slice(0, 50);
    }
    return selectableCams
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        const code = (c.camera_code || c.id || "").toLowerCase();
        const district = (c.district || "").toLowerCase();
        const dept = (c.department_name || c.department_id || "").toLowerCase();
        const taluka = (c.taluka || "").toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          district.includes(q) ||
          dept.includes(q) ||
          taluka.includes(q)
        );
      })
      .slice(0, 50);
  }, [selectableCams, camSearchQuery]);

  // Click outside to close camera dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (camDropdownRef.current && !camDropdownRef.current.contains(e.target)) {
        setIsCamDropdownOpen(false);
      }
    };
    if (isCamDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCamDropdownOpen]);

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

  useEffect(() => {
    if (activeVisionCam) {
      const source = activeVisionCam.rtsp_url || activeVisionCam.stream_url || (activeVisionCam.urls && (activeVisionCam.urls.rtsp || activeVisionCam.urls.hls || activeVisionCam.urls.whep)) || "";
      try {
        fetch("/api/v1/ai/stream_controls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: source,
            camera_id: activeVisionCam.id,
            camera_code: activeVisionCam.camera_code,
            detect_objects: Boolean(enableObjDetection),
            detect_plates: Boolean(enablePlateDetection),
            trails: Boolean(enableObjDetection),
            classes: selectedClasses
          })
        }).catch(() => {});
      } catch (_) {}
    }
  }, [enableObjDetection, enablePlateDetection, selectedClasses, activeVisionCam]);

  return (
    <div className="table-view hub-table-view">
      <div className="hub-layout-wrapper">

        {/* Left Hub Module Sidebar */}
        <aside className="hub-module-sidebar">
          {/* Sidebar Brand Header */}
          <div className="hub-sidebar-header">
            <div className="hub-sidebar-title">
              <Car size={17} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
              <span>AI Vision & ANPR</span>
            </div>
            <div className="hub-sidebar-subtitle">
              Statewide Intelligence Hub
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, marginTop: "4px" }}>

            <button
              type="button"
              className={`hub-nav-item ${activeTab === "ai_vision" ? "active" : ""}`}
              onClick={() => setActiveTab("ai_vision")}
            >
              <div className="nav-item-left">
                <Eye size={15} strokeWidth={2.2} />
                <span>Live AI Detection</span>
              </div>
            </button>

            <button
              type="button"
              className={`hub-nav-item ${activeTab === "detections" ? "active" : ""}`}
              onClick={() => setActiveTab("detections")}
            >
              <div className="nav-item-left">
                <Radio size={15} strokeWidth={2.2} />
                <span>Vehicle Intercepts</span>
              </div>
              <span className="hub-nav-badge">{totalDetections}</span>
            </button>



            <button
              type="button"
              className={`hub-nav-item ${activeTab === "watchlist" ? "active" : ""}`}
              onClick={() => setActiveTab("watchlist")}
            >
              <div className="nav-item-left">
                <ShieldAlert size={15} strokeWidth={2.2} />
                <span>Watchlist Database</span>
              </div>
              <span className="hub-nav-badge">{watchlistCount}</span>
            </button>

            <button
              type="button"
              className={`hub-nav-item ${activeTab === "edge_nodes" ? "active" : ""}`}
              onClick={() => setActiveTab("edge_nodes")}
            >
              <div className="nav-item-left">
                <Server size={15} strokeWidth={2.2} />
                <span>Edge Gateways</span>
              </div>
              <span className="hub-nav-badge">{edgeNodes.length}</span>
            </button>

            <button
              type="button"
              className={`hub-nav-item ${activeTab === "gov_gateways" ? "active" : ""}`}
              onClick={() => setActiveTab("gov_gateways")}
            >
              <div className="nav-item-left">
                <Building2 size={15} strokeWidth={2.2} />
                <span>Gov Gateways</span>
              </div>
              <span className="hub-nav-badge" style={{ fontSize: "9px" }}>API</span>
            </button>
          </div>

          {/* Sidebar Footer System Status */}
          <div style={{ padding: "10px 8px 4px", borderTop: "1px solid var(--panel-border)", marginTop: "auto", fontSize: "11px", color: "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>AI Engine</span>
            <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Active
            </span>
          </div>
        </aside>

        {/* Right Side: Tab View Content */}
        <main className="hub-content-area">
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
              height: "100%",
              minHeight: "400px",
              textAlign: "center"
            }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(34, 211, 238, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Eye size={28} style={{ color: "var(--accent)" }} />
              </div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>No Cameras Configured for Live AI Object Detection</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-dim)", maxWidth: "480px", lineHeight: "1.6" }}>
                Live Object Detection is currently not enabled on any camera. Go to <strong>Camera Registry</strong> or edit a camera and select <strong>"AI Object Detection & Classification"</strong> or check <strong>"Enable Live AI Object Detection"</strong>.
              </p>
            </div>
          ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            minHeight: "100%",
            paddingBottom: "24px"
          }}>
            {/* Upper: Live CCTV AI Vision Surveillance Grid */}
            <div style={{
              display: "flex",
              gap: "8px",
              height: "560px",
              minHeight: 0,
              alignItems: "stretch"
            }}>

          {/* Left Side: Live CCTV Stream Visualizer (Takes all available main space) */}
          <div style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            background: "#000",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            {activeVisionCam ? (
              <LiveCCTVFeed
                key={activeVisionCam.id}
                camera={activeVisionCam}
                isMuted={true}
                isDetailed={false}
                showAiVision={isAiStreamActive}
                defaultAiStream={isAiStreamActive}
                allowAiStreamControls={false}
                preferAiStream={isAiStreamActive}
                enableObjDetection={enableObjDetection}
                enablePlateDetection={enablePlateDetection}
                selectedClasses={selectedClasses}
              />
            ) : (
              <div style={{ color: "var(--text-dim)", fontSize: "13px" }}>
                Select a camera from the panel on the right to start live surveillance.
              </div>
            )}
          </div>


          {/* Right Side: Dedicated Control & Filter Sidebar Panel */}
          <div style={{
            width: "320px",
            flexShrink: 0,
            background: "var(--panel-bg)",
            borderRadius: "10px",
            border: "1px solid var(--panel-border)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto"
          }}>
            {/* 1. Camera Stream Selector Section */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "7px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Video size={13} style={{ color: "var(--accent)" }} /> Select Camera Stream
              </div>

              {/* Searchable Combobox (Max 50 items) */}
              <div ref={camDropdownRef} style={{ position: "relative", width: "100%" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsCamDropdownOpen(!isCamDropdownOpen)}
                  style={{
                    height: "36px",
                    width: "100%",
                    padding: "0 12px",
                    gap: "8px",
                    fontSize: "12.5px",
                    justifyContent: "space-between",
                    background: "var(--input-bg)",
                    border: isCamDropdownOpen ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
                    color: "var(--text-primary)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeVisionCam?.status === "OFFLINE" ? "var(--danger)" : "#10b981", flexShrink: 0 }}></span>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {activeVisionCam ? `${activeVisionCam.name}` : "Select Camera..."}
                    </span>
                  </div>
                  <ChevronDown size={14} style={{ color: "var(--text-dim)", flexShrink: 0, transform: isCamDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
                </button>

                {isCamDropdownOpen && (
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    maxHeight: "340px",
                    background: "var(--panel-bg-solid, #0f172a)",
                    border: "1px solid var(--panel-border-strong, rgba(255, 255, 255, 0.15))",
                    borderRadius: "10px",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.45)",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden"
                  }}>
                    {/* Search Input Box */}
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-border)", background: "var(--input-bg)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Search size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search camera, code, district..."
                        value={camSearchQuery}
                        onChange={(e) => setCamSearchQuery(e.target.value)}
                        style={{
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          color: "var(--text-primary)",
                          fontSize: "12px",
                          width: "100%",
                          padding: 0
                        }}
                      />
                      {camSearchQuery && (
                        <X
                          size={13}
                          style={{ cursor: "pointer", color: "var(--text-dim)", flexShrink: 0 }}
                          onClick={() => setCamSearchQuery("")}
                        />
                      )}
                    </div>

                    {/* Meta info strip */}
                    <div style={{ padding: "4px 10px", fontSize: "10.5px", color: "var(--text-dim)", background: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between" }}>
                      <span>Max 50 cameras {camSearchQuery ? `(Filtered)` : `(Default)`}</span>
                      <span>Total: {selectableCams.length}</span>
                    </div>

                    {/* Scrollable Camera List */}
                    <div style={{ overflowY: "auto", maxHeight: "250px", padding: "4px" }}>
                      {filteredVisionCams.length === 0 ? (
                        <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px" }}>
                          No cameras found matching "{camSearchQuery}"
                        </div>
                      ) : (
                        filteredVisionCams.map((cam) => {
                          const isSelected = activeVisionCam?.id === cam.id;
                          return (
                            <div
                              key={cam.id}
                              onClick={() => {
                                handleSelectVisionCam(cam.id);
                                setIsCamDropdownOpen(false);
                              }}
                              style={{
                                padding: "7px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                background: isSelected ? "rgba(34, 211, 238, 0.12)" : "transparent",
                                border: isSelected ? "1px solid rgba(34, 211, 238, 0.3)" : "1px solid transparent",
                                marginBottom: "2px",
                                transition: "all 0.15s ease"
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "var(--input-bg)";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <div style={{ overflow: "hidden" }}>
                                <div style={{ fontWeight: 700, fontSize: "12px", color: isSelected ? "var(--accent)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {cam.name}
                                </div>
                                <div style={{ fontSize: "10px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                  <span style={{ fontFamily: "var(--font-mono)" }}>{cam.camera_code || cam.id}</span>
                                  <span>·</span>
                                  <span>{cam.district || "Gujarat"}</span>
                                </div>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                {(cam.detection_mode === "ANPR_DETECTION" || cam.detection_mode === "ANPR") && (
                                  <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 4px", borderRadius: "3px", background: "rgba(34, 211, 238, 0.2)", color: "var(--accent)" }}>
                                    ANPR
                                  </span>
                                )}
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cam.status === "OFFLINE" ? "var(--danger)" : "#10b981" }}></span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* 2. Stream Processing Mode (Raw vs AI Stream Toggle) */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "7px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers size={13} style={{ color: "var(--accent)" }} /> Stream Processing Mode
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                background: "var(--input-bg)",
                padding: "4px",
                borderRadius: "8px",
                border: "1px solid var(--panel-border)"
              }}>
                <button
                  type="button"
                  onClick={() => setIsAiStreamActive(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: !isAiStreamActive ? "1px solid #3b82f6" : "1px solid transparent",
                    background: !isAiStreamActive ? "rgba(59, 130, 246, 0.2)" : "transparent",
                    color: !isAiStreamActive ? "#38bdf8" : "var(--text-dim)",
                    fontWeight: !isAiStreamActive ? 800 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Video size={13} /> Raw Stream
                </button>

                <button
                  type="button"
                  onClick={() => setIsAiStreamActive(true)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: isAiStreamActive ? "1px solid #10b981" : "1px solid transparent",
                    background: isAiStreamActive ? "rgba(16, 185, 129, 0.2)" : "transparent",
                    color: isAiStreamActive ? "#10b981" : "var(--text-dim)",
                    fontWeight: isAiStreamActive ? 800 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Eye size={13} /> AI Stream
                </button>
              </div>
            </div>

            {/* 3. AI Detection Filters Panel (Only visible when AI Stream is active) */}
            {isAiStreamActive && (
              <div style={{
                background: "var(--input-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: "10px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <SlidersHorizontal size={13} style={{ color: "var(--accent)" }} /> AI Detection Filters
                </div>

                {/* Master Object Detection Toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12.5px", color: "var(--text-primary)", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={enableObjDetection}
                    onChange={(e) => setEnableObjDetection(e.target.checked)}
                    style={{ accentColor: "#3b82f6", cursor: "pointer", width: "14px", height: "14px" }}
                  />
                  <span>Object Detection</span>
                </label>

                {/* Specific Classes Sub-Filters */}
                {enableObjDetection && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    paddingLeft: "16px",
                    borderLeft: "2px solid rgba(59, 130, 246, 0.4)"
                  }}>
                    {[
                      { id: "person", label: "Persons / Pedestrians" },
                      { id: "car", label: "Cars & Light Vehicles" },
                      { id: "bike", label: "Bikes & Motorcycles" },
                      { id: "truck_bus", label: "Trucks & Buses" },
                      { id: "other", label: "Other Tracked Objects" }
                    ].map(item => (
                      <label
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          cursor: "pointer",
                          fontSize: "11.5px",
                          color: selectedClasses[item.id] ? "var(--text-primary)" : "var(--text-dim)",
                          margin: 0
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedClasses[item.id]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedClasses(prev => ({ ...prev, [item.id]: checked }));
                          }}
                          style={{ accentColor: "#3b82f6", cursor: "pointer", width: "13px", height: "13px" }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div style={{ height: "1px", background: "var(--panel-border)", margin: "2px 0" }} />

                {/* ANPR Master Toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12.5px", color: "var(--text-primary)", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={enablePlateDetection}
                    onChange={(e) => setEnablePlateDetection(e.target.checked)}
                    style={{ accentColor: "#eab308", cursor: "pointer", width: "14px", height: "14px" }}
                  />
                  <span style={{ color: "#eab308" }}>ANPR Plate Recognition</span>
                </label>
              </div>
            )}

            </div>
          </div>

          {/* Lower Section: Offline Recorded Video AI Forensic Scanner & Interactive Timeline */}
          <ForensicVideoAnalyzer addToast={addToast} watchlist={watchlist} />
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
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* Header & Auto-Distribute Bar */}
          <div className="table-unified-toolbar" style={{ marginBottom: "12px", flexShrink: 0 }}>
            <div className="toolbar-filters-group" style={{ flex: 1, minWidth: "auto" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Server size={16} style={{ color: "var(--accent)" }} /> AI ANPR Edge Nodes
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--text-dim)" }}>
                  Distributed worker nodes auto-assigned with cameras & watchlist targets.
                </p>
              </div>
            </div>
            <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                <Zap size={14} /> Auto-Distribute
              </button>
              <button className="btn btn-sm btn-secondary" onClick={fetchEdgeNodes} style={{ gap: "5px" }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>


          {/* Scrollable Table */}
          <div className="table-wrap">
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
                edgeNodes.slice((edgePage - 1) * edgePerPage, edgePage * edgePerPage).map((node) => {
                  const isOnline = node.status === "ONLINE";
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
                      title="Click to view all assigned cameras in modal"
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
                          {assignedCount} / {maxCap} Cameras
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
                            SCANNING (ACTIVE)
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
                            OFFLINE (WATCHDOG)
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

          {/* Pagination Footer — Outside table-wrap so it sticks to bottom */}
          {edgeNodes.length > 0 && (
            <div className="table-pagination-footer" style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--panel-border)",
              marginTop: "10px",
              flexWrap: "wrap",
              gap: "12px",
              background: "var(--panel-bg)",
              borderRadius: "0 0 8px 8px",
              flexShrink: 0
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                  Showing <strong style={{ color: "var(--text-primary)" }}>{(edgePage - 1) * edgePerPage + 1}</strong>–<strong style={{ color: "var(--text-primary)" }}>{Math.min(edgePage * edgePerPage, edgeNodes.length)}</strong> of <strong style={{ color: "var(--accent)" }}>{edgeNodes.length}</strong> edge nodes
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
                  <span>Rows per page:</span>
                  <select
                    value={edgePerPage}
                    onChange={(e) => {
                      setEdgePerPage(Number(e.target.value));
                      setEdgePage(1);
                    }}
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--panel-border)",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <Pagination
                currentPage={edgePage}
                totalPages={Math.max(1, Math.ceil(edgeNodes.length / edgePerPage))}
                onPageChange={(p) => setEdgePage(p)}
              />
            </div>
          )}
        </div>

      ) : activeTab === "gov_gateways" ? (

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Banner */}
          <div className="table-unified-toolbar" style={{ marginBottom: "12px" }}>
            <div className="toolbar-filters-group" style={{ flex: 1, minWidth: "auto" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building2 size={16} style={{ color: "#38bdf8" }} />
                  Gov Registry Integrations
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--text-dim)" }}>
                  VAHAN, eGujCop (CCTNS), SARATHI & NAFIS adapter configurations.
                </p>
              </div>
            </div>
            <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className="badge badge-success" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", padding: "5px 10px" }}>
                4/4 Adapters Ready
              </span>
            </div>
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
                    {gw.status}
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
                      API Authentication Token / Key
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={gw.apiKey}
                      onChange={(e) => handleUpdateGateway(gw.id, "apiKey", e.target.value)}
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
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", borderTop: "1px solid var(--panel-border)", paddingTop: "10px" }}>
                  <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>
                    Timeout: <strong>{gw.timeout}</strong>
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleSaveGateway(gw)}
                    style={{ padding: "3px 10px", fontSize: "11.5px" }}
                  >
                    Save Config
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Test Inter-Agency Lookup Tool */}
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            borderRadius: "10px",
            padding: "16px 20px"
          }}>
            <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--text-primary)", fontWeight: 700 }}>
              Test Inter-Agency Registry Lookups
            </h4>
            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--text-dim)" }}>
              Simulate high-speed API payload query against VAHAN & eGujCop mock service endpoints.
            </p>

            <form onSubmit={handleRunSimpleTest} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Enter vehicle plate number (e.g. GJ01AB1234)"
                value={testPlateInput}
                onChange={(e) => setTestPlateInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRunSimpleTest(e);
                  }
                }}
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--panel-border)",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  flex: "1 1 240px",
                  maxWidth: "320px"
                }}
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={isQuerying}
                style={{ gap: "6px" }}
              >
                <Search size={14} /> {isQuerying ? "Querying..." : "Simulate Query & Inspect Details"}
              </button>
            </form>

            {testQueryOutput && (
              <div
                onClick={() => setIsLookupModalOpen(true)}
                style={{
                  marginTop: "14px",
                  padding: "12px 14px",
                  background: "var(--input-bg)",
                  border: "1px solid rgba(34, 211, 238, 0.3)",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                title="Click to view detailed modal"
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, color: "var(--accent)" }}>
                    {testQueryOutput.plate}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    <strong>VAHAN:</strong> {testQueryOutput.vahan}
                  </span>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>
                    <strong>eGujCop:</strong> {testQueryOutput.egujcop}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    Latency: <span style={{ color: "#10b981", fontWeight: 700 }}>{testQueryOutput.latency}</span>
                  </div>
                  <span className="badge" style={{ fontSize: "10.5px", background: "rgba(34, 211, 238, 0.12)", color: "var(--accent)", border: "1px solid rgba(34, 211, 238, 0.3)", gap: "4px" }}>
                    <Eye size={11} /> View Modal
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (


        <>
          {/* Search & Modern Filter Toolbar */}
          <div className="table-unified-toolbar" style={{ marginBottom: "12px" }}>
            <div className="toolbar-filters-group" style={{ flex: 1, minWidth: "auto" }}>
              {/* Left Side: Prominent Suspects vs All Scans Mode Switcher */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--input-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: "8px",
                padding: "3px",
                gap: "3px",
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setWatchlistOnly(true);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: watchlistOnly ? "1px solid rgba(244, 63, 94, 0.45)" : "1px solid transparent",
                    background: watchlistOnly ? "rgba(244, 63, 94, 0.18)" : "transparent",
                    color: watchlistOnly ? "#fb7185" : "var(--text-secondary)",
                    fontWeight: watchlistOnly ? 700 : 500,
                    fontSize: "12px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: watchlistOnly ? "0 0 12px rgba(244, 63, 94, 0.25)" : "none"
                  }}
                  title="Show only hotlist/wanted suspect vehicles (Default)"
                >
                  <ShieldAlert size={14} style={{ color: watchlistOnly ? "#fb7185" : "var(--text-dim)" }} />
                  <span>Suspects Only</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWatchlistOnly(false);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: !watchlistOnly ? "1px solid var(--accent)" : "1px solid transparent",
                    background: !watchlistOnly ? "rgba(34, 211, 238, 0.15)" : "transparent",
                    color: !watchlistOnly ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: !watchlistOnly ? 700 : 500,
                    fontSize: "12px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: !watchlistOnly ? "0 0 12px rgba(34, 211, 238, 0.2)" : "none"
                  }}
                  title="Show all passing vehicle scans"
                >
                  <Car size={14} />
                  <span>All Scans</span>
                </button>
              </div>
            </div>

            {/* Right Side: Small Search Box + Filter Dropdown + Refresh */}
            <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Compact Search Box on Right */}
              <div className="search-box" style={{ width: "200px", height: "36px", flexShrink: 0 }}>
                <Search size={14} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search plate, camera..."
                  value={searchPlate}
                  onChange={(e) => {
                    setSearchPlate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ fontSize: "12px" }}
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

              {/* District Filter Popover (Right-Anchored so it never overflows content) */}
              <div style={{ position: "relative", zIndex: 1000 }}>
                <button
                  className="btn"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    gap: "6px",
                    fontSize: "12px",
                    background: activeFilterCount > 0 ? "rgba(34, 211, 238, 0.15)" : "var(--input-bg)",
                    borderColor: activeFilterCount > 0 ? "var(--accent)" : "var(--panel-border)",
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
                    <div className="filter-popover-dropdown" style={{ right: 0, left: "auto", minWidth: "260px" }}>
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

              <button
                className="btn"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                style={{ height: "36px", padding: "0 12px", gap: "6px" }}
                title="Refresh vehicle passage logs"
              >
                <RefreshCw size={13} className={isRefreshing ? "spin-anim" : ""} />
                <span>{isRefreshing ? "Refreshing..." : "Refresh Logs"}</span>
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
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>No vehicle passages detected yet.</div>
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>When vehicles pass through any Gujarat ANPR-enabled CCTV camera, their logs and suspect alerts will appear here in real-time.</div>
                    </td>
                  </tr>
                ) : (
                  detections.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((det) => {
                    const isHit = !!det.is_watchlist_hit;

                    return (
                      <tr key={det.id} style={{ background: isHit ? "rgba(244,63,94,0.06)" : "transparent" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <div className={`vehicle-plate-box ${isHit ? "hit" : ""}`}>
                              <span className="plate-flag">IND</span>
                              <span className="plate-number">{det.vehicle_plate}</span>
                            </div>
                            {det.snapshot_url && (
                              <button
                                className="btn btn-sm"
                                onClick={() => setSelectedSnapshotDet(det)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  gap: "4px",
                                  background: "rgba(56, 189, 248, 0.12)",
                                  borderColor: "rgba(56, 189, 248, 0.3)",
                                  color: "#38bdf8"
                                }}
                                title="View Captured Vehicle Crop Snapshot"
                              >
                                <Camera size={12} />
                                <span>Photo</span>
                              </button>
                            )}
                            {isHit ? (
                              <span className="threat-severity-badge critical" style={{ fontSize: "11px", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                <ShieldAlert size={12} />
                                <span>SUSPECT INTERCEPT · {det.watchlist_category ? det.watchlist_category.replace(/_/g, " ") : "WATCHLIST"} ({det.watchlist_fir || "Active FIR"})</span>
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: "10.5px", padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                                <CheckCircle2 size={12} />
                                <span>CLEAN VEHICLE PASS</span>
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
                          <span className="badge" style={{ background: "rgba(100, 116, 139, 0.15)", color: "#cbd5e1", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <MapPin size={11} />
                            <span>{det.district || "Gujarat"}</span>
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

          {/* Enhanced Responsive Pagination Footer */}
          {detections.length > 0 && (
            <div className="table-pagination-footer" style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid var(--panel-border)",
              marginTop: "10px",
              flexWrap: "wrap",
              gap: "12px",
              background: "var(--panel-bg)",
              borderRadius: "0 0 8px 8px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                  Showing <strong style={{ color: "var(--text-primary)" }}>{(currentPage - 1) * itemsPerPage + 1}</strong>–<strong style={{ color: "var(--text-primary)" }}>{Math.min(currentPage * itemsPerPage, detections.length)}</strong> of <strong style={{ color: "var(--accent)" }}>{detections.length}</strong> detection records
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
                  <span>Rows per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--panel-border)",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "12px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                </div>
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(detections.length / itemsPerPage))}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </>
      )}
        </main>
      </div>

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

      {/* Captured ANPR Snapshot Modal */}
      {selectedSnapshotDet && (

        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={() => setSelectedSnapshotDet(null)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "520px",
              padding: "20px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={18} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)", fontWeight: 700 }}>
                  Captured Vehicle Snapshot
                </h3>
              </div>
              <button
                className="btn btn-sm btn-icon"
                onClick={() => setSelectedSnapshotDet(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Snapshot Image */}
            <div style={{
              width: "100%",
              height: "260px",
              backgroundColor: "#020617",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--panel-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px"
            }}>
              {selectedSnapshotDet.snapshot_url ? (
                <img
                  src={selectedSnapshotDet.snapshot_url}
                  alt={selectedSnapshotDet.vehicle_plate}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div style={{ display: selectedSnapshotDet.snapshot_url ? 'none' : 'flex', flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--text-dim)" }}>
                <Car size={36} />
                <span style={{ fontSize: "12px" }}>Raw Crop Snapshot Stored on Disk</span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              backgroundColor: "rgba(30, 41, 59, 0.5)",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "12px",
              marginBottom: "16px"
            }}>
              <div>
                <span style={{ color: "var(--text-dim)", display: "block", fontSize: "11px" }}>License Plate</span>
                <strong style={{ color: "#38bdf8", fontFamily: "var(--font-mono)", fontSize: "14px" }}>
                  {selectedSnapshotDet.vehicle_plate}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", display: "block", fontSize: "11px" }}>Confidence</span>
                <strong style={{ color: "#4ade80" }}>
                  {selectedSnapshotDet.confidence || 95}%
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", display: "block", fontSize: "11px" }}>Camera Node</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  [{selectedSnapshotDet.camera_code || selectedSnapshotDet.camera_id}] {selectedSnapshotDet.camera_name || "CCTV Node"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-dim)", display: "block", fontSize: "11px" }}>Detection Time</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {new Date(selectedSnapshotDet.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const plate = selectedSnapshotDet.vehicle_plate;
                  setSelectedSnapshotDet(null);
                  onTrackVehicleOnMap(plate);
                }}
              >
                <LocateFixed size={13} /> Trace Route on Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inter-Agency Registry Intelligence Lookup Modal */}
      {isLookupModalOpen && lookupResult && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal modal-lg" style={{ maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", width: "90%", maxWidth: "800px" }}>
            {/* Modal Header */}
            <div className="modal-head" style={{ flexShrink: 0, borderBottom: "1px solid var(--panel-border)", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 211, 238, 0.15)",
                  border: `1px solid ${lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 211, 238, 0.3)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: lookupResult.isWatchlistMatch ? "#ef4444" : "var(--accent)"
                }}>
                  {lookupResult.isWatchlistMatch ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>
                      Inter-Agency Vehicle Intelligence Records
                    </h3>
                    <span className="badge" style={{
                      background: lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: lookupResult.isWatchlistMatch ? "#ef4444" : "#10b981",
                      border: `1px solid ${lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                      fontSize: "10.5px",
                      fontWeight: 800
                    }}>
                      {lookupResult.isWatchlistMatch ? "POLICE WATCHLIST HIT" : "CLEAN VERIFIED"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-dim)" }}>
                    Cross-referenced via VAHAN 4.0 (MoRTH) & eGujCop Police CCTNS Network
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setIsLookupModalOpen(false)}>
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
              {/* Top Banner: HSRP Plate & Status */}
              <div style={{
                background: "var(--input-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: "10px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  {/* Indian HSRP License Plate Box */}
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    border: "2px solid #1e293b",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: "#ffffff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
                  }}>
                    <div style={{
                      background: "#1e3a8a",
                      color: "#fff",
                      padding: "4px 6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      fontWeight: 900,
                      lineHeight: 1
                    }}>
                      <span>🇮🇳</span>
                      <span style={{ fontSize: "8px", marginTop: "2px" }}>IND</span>
                    </div>
                    <div style={{
                      padding: "6px 14px",
                      color: "#0f172a",
                      fontFamily: "var(--font-mono)",
                      fontSize: "18px",
                      fontWeight: 900,
                      letterSpacing: "1.5px"
                    }}>
                      {lookupResult.formattedPlate || lookupResult.plate}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>
                      {lookupResult.vahan.makerModel}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Registered to: <strong style={{ color: "var(--text-primary)" }}>{lookupResult.vahan.ownerName}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge" style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "rgba(34, 211, 238, 0.12)",
                    color: "var(--accent)",
                    border: "1px solid rgba(34, 211, 238, 0.3)"
                  }}>
                    <Building2 size={12} /> {lookupResult.vahan.rtoJurisdiction}
                  </span>
                </div>
              </div>

              {/* 2-Column Grid: VAHAN vs eGujCop */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                {/* Column 1: VAHAN 4.0 National Vehicle Registry */}
                <div style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "10px",
                  padding: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", borderBottom: "1px solid var(--panel-border)", paddingBottom: "10px" }}>
                    <Database size={15} style={{ color: "var(--accent)" }} />
                    <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                      VAHAN 4.0 (MoRTH Registry)
                    </h4>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>RC Status:</span>
                      <span style={{ color: "#10b981", fontWeight: 800 }}>{lookupResult.vahan.rcStatus}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Vehicle Class:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.vahan.vehicleClass}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Fuel / Emission:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.vahan.fuelType}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Registration Date:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.vahan.registrationDate} ({lookupResult.vahan.vehicleAge})</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Insurance Validity:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.vahan.insuranceValidity}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>PUC Certificate:</span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>{lookupResult.vahan.pucValidity}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Fitness Certificate:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.vahan.fitnessValidity}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Chassis No. (Masked):</span>
                      <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{lookupResult.vahan.chassisNumber}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: eGujCop Crime & Police Watchlist */}
                <div style={{
                  background: lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.04)" : "var(--input-bg)",
                  border: `1px solid ${lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.3)" : "var(--panel-border)"}`,
                  borderRadius: "10px",
                  padding: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", borderBottom: `1px solid ${lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.2)" : "var(--panel-border)"}`, paddingBottom: "10px" }}>
                    <ShieldAlert size={15} style={{ color: lookupResult.isWatchlistMatch ? "#ef4444" : "#10b981" }} />
                    <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)" }}>
                      eGujCop Police & Crime Network
                    </h4>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Crime / FIR Status:</span>
                      <span style={{ color: lookupResult.isWatchlistMatch ? "#ef4444" : "#10b981", fontWeight: 800 }}>
                        {lookupResult.egujcop.crimeStatus}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>FIR Number:</span>
                      <span style={{ color: lookupResult.isWatchlistMatch ? "#ef4444" : "var(--text-primary)", fontWeight: 700 }}>
                        {lookupResult.egujcop.firNumber}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Police Jurisdiction:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.egujcop.policeStation}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Category:</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lookupResult.egujcop.crimeCategory}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Action Priority:</span>
                      <span className="badge" style={{
                        background: lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.15)" : "rgba(148, 163, 184, 0.12)",
                        color: lookupResult.isWatchlistMatch ? "#ef4444" : "var(--text-secondary)",
                        border: `1px solid ${lookupResult.isWatchlistMatch ? "rgba(239, 68, 68, 0.3)" : "var(--panel-border)"}`,
                        fontSize: "10.5px"
                      }}>
                        {lookupResult.egujcop.priority}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Seizure Order:</span>
                      <span style={{ color: lookupResult.isWatchlistMatch ? "#ef4444" : "var(--text-secondary)", fontWeight: 600 }}>
                        {lookupResult.egujcop.seizureOrder}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-dim)" }}>Last Sighting:</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "11px", textAlign: "right" }}>{lookupResult.egujcop.lastSighting}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Telemetry Card */}
              <div style={{
                background: "rgba(15, 23, 42, 0.05)",
                border: "1px dashed var(--panel-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                fontSize: "11px",
                color: "var(--text-dim)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Lock size={12} style={{ color: "var(--accent)" }} />
                  <span>Protocol: <strong style={{ color: "var(--text-primary)" }}>{lookupResult.network.protocol}</strong></span>
                </div>
                <div>
                  Latency: <span style={{ color: "#10b981", fontWeight: 700 }}>{lookupResult.network.latency}</span> · Node: <span style={{ color: "var(--text-secondary)" }}>{lookupResult.network.clientNode}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-foot" style={{ flexShrink: 0, borderTop: "1px solid var(--panel-border)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-bg)" }}>
              <button
                className="btn btn-sm"
                onClick={() => {
                  const summary = `VEHICLE INTELLIGENCE REPORT\nPlate: ${lookupResult.formattedPlate}\nModel: ${lookupResult.vahan.makerModel}\nOwner: ${lookupResult.vahan.ownerName}\nRTO: ${lookupResult.vahan.rtoJurisdiction}\nRC Status: ${lookupResult.vahan.rcStatus}\neGujCop Status: ${lookupResult.egujcop.crimeStatus}\nFIR: ${lookupResult.egujcop.firNumber}\nStation: ${lookupResult.egujcop.policeStation}`;
                  navigator.clipboard.writeText(summary);
                  if (addToast) addToast("Vehicle intelligence report copied to clipboard!", "success", "Copied");
                }}
                style={{ gap: "6px" }}
              >
                <Copy size={13} /> Copy Report Summary
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                {!lookupResult.isWatchlistMatch && onOpenAddWatchlist && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      setIsLookupModalOpen(false);
                      onOpenAddWatchlist({
                        vehicle_plate: lookupResult.plate,
                        vehicle_type: lookupResult.vahan.vehicleClass,
                        owner_name: lookupResult.vahan.ownerName
                      });
                    }}
                    style={{ gap: "6px" }}
                  >
                    <ShieldAlert size={13} /> Flag to Watchlist
                  </button>
                )}
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setIsLookupModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


