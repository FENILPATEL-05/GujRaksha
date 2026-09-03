import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Upload,
  Video,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Car,
  User,
  Shield,
  Search,
  Sparkles,
  SlidersHorizontal,
  Layers,
  ChevronRight,
  Eye,
  RefreshCw,
  Trash2,
  Film
} from "lucide-react";

export const ForensicVideoAnalyzer = ({ addToast, watchlist = [] }) => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Scanning State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState("");
  const [scanIntervalSec, setScanIntervalSec] = useState(0.8); // Sample every 0.8s

  // Detections Data
  const [detections, setDetections] = useState([]);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [filterType, setFilterType] = useState("all"); // 'all', 'plates', 'vehicles', 'persons', 'watchlist'
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const offscreenVideoRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const isCancelledRef = useRef(false);

  // Format seconds to mm:ss or mm:ss.ms
  const formatTime = (seconds, includeMs = false) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    const pad = (n) => String(n).padStart(2, "0");
    if (includeMs) {
      return `${pad(mins)}:${pad(secs)}.${ms}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Handle File Upload
  const handleFileChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv|avi)$/i)) {
      if (addToast) addToast("Please upload a valid video file (.mp4, .webm, .mov)", "warning");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setDetections([]);
    setSelectedDetection(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setScanProgress(0);
    setScanStatusText("");
    if (addToast) addToast(`Video loaded: ${file.name}`, "info");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    isCancelledRef.current = true;
    setIsAnalyzing(false);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setDetections([]);
    setSelectedDetection(null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Video Loaded Metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 0);
    }
  };

  // Match plate against watchlist
  const checkIsWatchlist = useCallback((plateStr) => {
    if (!plateStr || !watchlist || watchlist.length === 0) return false;
    const cleanP = String(plateStr).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return watchlist.some(w => {
      const wPlate = String(w.plateNumber || w.plate_number || w.vehicle_plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return wPlate && (cleanP === wPlate || cleanP.includes(wPlate) || wPlate.includes(cleanP));
    });
  }, [watchlist]);

  // AI Frame Analyzer
  const analyzeSingleFrame = async (canvas, timestamp) => {
    const base64Data = canvas.toDataURL("image/jpeg", 0.85);
    let objects = [];
    let plates = [];

    try {
      const res = await fetch("/api/v1/ai/scan_frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data })
      });
      const data = await res.json();
      if (data.success) {
        objects = data.objects || [];
        plates = data.plates || [];
      }
    } catch (_) {
      // Backend AI offline fallback
    }

    // Convert to unified detection records
    const frameDetections = [];
    const frameW = canvas.width || 640;
    const frameH = canvas.height || 360;

    // 1. Process Plates
    plates.forEach((p, idx) => {
      const isWatchlistHit = checkIsWatchlist(p.plate_text);
      const [bx, by, bw, bh] = p.box || [0.3, 0.4, 0.4, 0.2];
      
      // Extract thumbnail snapshot
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = 120;
      snapCanvas.height = 60;
      const sCtx = snapCanvas.getContext("2d");
      const sx = Math.max(0, (bx - 0.05) * frameW);
      const sy = Math.max(0, (by - 0.05) * frameH);
      const sw = Math.min(frameW - sx, (bw + 0.1) * frameW);
      const sh = Math.min(frameH - sy, (bh + 0.1) * frameH);
      sCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, 120, 60);

      frameDetections.push({
        id: `plt_${timestamp.toFixed(2)}_${idx}_${Date.now()}`,
        time: timestamp,
        timeFormatted: formatTime(timestamp, true),
        type: "PLATE",
        label: p.plate_text || "PLATE",
        confidence: Math.round((p.confidence || 0.9) * 100),
        box: p.box,
        isWatchlist: isWatchlistHit,
        snapshot: snapCanvas.toDataURL("image/jpeg", 0.8)
      });
    });

    // 2. Process Objects
    objects.forEach((obj, idx) => {
      const cls = String(obj.class || "object").toLowerCase();
      const isCar = ["car", "bus", "truck", "van", "suv", "vehicle"].includes(cls);
      const isPerson = ["person", "pedestrian"].includes(cls);
      const isBike = ["motorcycle", "bike", "bicycle"].includes(cls);
      const [bx, by, bw, bh] = obj.box || [0.2, 0.2, 0.4, 0.4];

      // Extract object thumbnail
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = 90;
      snapCanvas.height = 70;
      const sCtx = snapCanvas.getContext("2d");
      const sx = Math.max(0, bx * frameW);
      const sy = Math.max(0, by * frameH);
      const sw = Math.min(frameW - sx, bw * frameW);
      const sh = Math.min(frameH - sy, bh * frameH);
      sCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, 90, 70);

      frameDetections.push({
        id: `obj_${timestamp.toFixed(2)}_${idx}_${Date.now()}`,
        time: timestamp,
        timeFormatted: formatTime(timestamp, true),
        type: isCar ? "CAR" : isPerson ? "PERSON" : isBike ? "MOTORCYCLE" : "OBJECT",
        label: cls.toUpperCase(),
        confidence: Math.round((obj.confidence || 0.85) * 100),
        box: obj.box,
        isWatchlist: false,
        snapshot: snapCanvas.toDataURL("image/jpeg", 0.75)
      });
    });

    return frameDetections;
  };

  // Start Full Video AI Forensic Scan
  const startForensicScan = async () => {
    if (!videoUrl || !offscreenVideoRef.current) return;
    setIsAnalyzing(true);
    setScanProgress(0);
    setDetections([]);
    setSelectedDetection(null);
    isCancelledRef.current = false;

    const v = offscreenVideoRef.current;
    v.src = videoUrl;

    await new Promise((resolve) => {
      v.onloadedmetadata = () => resolve();
      v.load();
    });

    const duration = v.duration || videoDuration || 10;
    const interval = Math.max(0.4, scanIntervalSec);
    const totalSteps = Math.floor(duration / interval);
    let currentStep = 0;
    const allFound = [];

    const offCanvas = offscreenCanvasRef.current || document.createElement("canvas");
    const offCtx = offCanvas.getContext("2d");

    for (let t = 0; t <= duration; t += interval) {
      if (isCancelledRef.current) break;

      currentStep++;
      setScanProgress(Math.min(99, Math.round((currentStep / totalSteps) * 100)));
      setScanStatusText(`Scanning video timeline at ${formatTime(t)} (${currentStep}/${totalSteps} frames)...`);

      // Seek offscreen video to timestamp
      await new Promise((resolve) => {
        v.currentTime = t;
        v.onseeked = () => resolve();
      });

      offCanvas.width = v.videoWidth || 640;
      offCanvas.height = v.videoHeight || 360;
      offCtx.drawImage(v, 0, 0, offCanvas.width, offCanvas.height);

      const frameResults = await analyzeSingleFrame(offCanvas, t);
      if (frameResults.length > 0) {
        allFound.push(...frameResults);
        setDetections([...allFound]);
      }
    }

    setIsAnalyzing(false);
    setScanProgress(100);
    setScanStatusText(`Scan Complete! Found ${allFound.length} AI Detection Events across ${formatTime(duration)}.`);
    if (addToast) addToast(`AI Forensic Analysis complete: ${allFound.length} detections stored.`, "success");
  };

  const cancelForensicScan = () => {
    isCancelledRef.current = true;
    setIsAnalyzing(false);
    setScanStatusText("Analysis cancelled by user.");
  };

  // Video Time Update & Dynamic Canvas Drawing
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);
    drawOverlayForTime(cur);
  };

  // Draw Bounding Boxes on Overlay Canvas
  const drawOverlayForTime = useCallback((timeSec) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth || 640;
    canvas.height = parent.clientHeight || 360;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find active detections in the +/- 0.6s window of currentTime
    const activeDets = detections.filter(d => Math.abs(d.time - timeSec) <= 0.6);

    // If a specific detection is selected, always highlight it prominently
    const listToDraw = selectedDetection && Math.abs(selectedDetection.time - timeSec) <= 1.2
      ? [...activeDets.filter(d => d.id !== selectedDetection.id), selectedDetection]
      : activeDets;

    listToDraw.forEach(det => {
      const isSelected = selectedDetection && selectedDetection.id === det.id;
      const [bx, by, bw, bh] = det.box || [0.2, 0.2, 0.4, 0.4];
      const x = bx * canvas.width;
      const y = by * canvas.height;
      const w = Math.max(20, bw * canvas.width);
      const h = Math.max(20, bh * canvas.height);

      let color = "#38bdf8"; // Blue for vehicles/objects
      if (det.isWatchlist) color = "#ef4444"; // Red for Watchlist
      else if (det.type === "PLATE") color = "#eab308"; // Yellow for Plates
      else if (det.type === "PERSON") color = "#06b6d4"; // Cyan for Persons

      ctx.save();

      // Bounding Box
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3.5 : 2.2;
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 12 : 6;
      ctx.strokeRect(x, y, w, h);

      // Corner Brackets for High-Tech Military HUD Style
      const cl = Math.min(14, w / 4, h / 4);
      ctx.lineWidth = 3.5;
      // Top-Left
      ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl); ctx.stroke();

      // Label Tag Background
      const labelText = det.type === "PLATE" ? `PLATE: ${det.label}` : `${det.label} (${det.confidence}%)`;
      ctx.font = "bold 11.5px monospace";
      const txtWidth = ctx.measureText(labelText).width;
      const tagH = 20;
      const tagY = Math.max(0, y - tagH - 4);

      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.fillRect(x, tagY, txtWidth + 14, tagH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, tagY, txtWidth + 14, tagH);

      // Label Text
      ctx.fillStyle = color;
      ctx.fillText(labelText, x + 6, tagY + 14);

      // Timestamp Tag
      if (isSelected) {
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(`⏱️ ${det.timeFormatted}`, x, y + h + 15);
      }

      ctx.restore();
    });
  }, [detections, selectedDetection]);

  // Click on Detection Card -> Seek Video & Highlight
  const handleSelectDetection = (det) => {
    setSelectedDetection(det);
    if (videoRef.current) {
      videoRef.current.currentTime = det.time;
      setCurrentTime(det.time);
      drawOverlayForTime(det.time);
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Seek Video via Timeline Slider
  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
    drawOverlayForTime(val);
  };

  // Filtered Detections List
  const filteredDetections = useMemo(() => {
    return detections.filter(d => {
      // Type Filter
      if (filterType === "plates" && d.type !== "PLATE") return false;
      if (filterType === "vehicles" && !["CAR", "BUS", "TRUCK", "MOTORCYCLE"].includes(d.type)) return false;
      if (filterType === "persons" && d.type !== "PERSON") return false;
      if (filterType === "watchlist" && !d.isWatchlist) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLabel = (d.label || "").toLowerCase().includes(q);
        const matchTime = (d.timeFormatted || "").toLowerCase().includes(q);
        const matchType = (d.type || "").toLowerCase().includes(q);
        if (!matchLabel && !matchTime && !matchType) return false;
      }
      return true;
    });
  }, [detections, filterType, searchQuery]);

  // Metrics
  const totalDetectionsCount = detections.length;
  const plateCount = detections.filter(d => d.type === "PLATE").length;
  const vehicleCount = detections.filter(d => ["CAR", "BUS", "TRUCK", "MOTORCYCLE"].includes(d.type)).length;
  const personCount = detections.filter(d => d.type === "PERSON").length;
  const watchlistHitsCount = detections.filter(d => d.isWatchlist).length;

  // Export CSV Report
  const handleExportCSV = () => {
    if (detections.length === 0) return;
    const headers = ["Index", "Timestamp_Sec", "Time_Formatted", "Type", "Detection_Label", "Confidence_Pct", "Watchlist_Alert"];
    const rows = detections.map((d, i) => [
      i + 1,
      d.time.toFixed(2),
      d.timeFormatted,
      d.type,
      d.label,
      `${d.confidence}%`,
      d.isWatchlist ? "YES" : "NO"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Forensic_AI_Report_${videoFile?.name || "Video"}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast("Forensic Report CSV Exported Successfully", "success");
  };

  return (
    <div style={{
      background: "var(--panel-bg)",
      border: "1px solid var(--panel-border)",
      borderRadius: "10px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      marginTop: "16px"
    }}>
      {/* Hidden Offscreen Video & Canvas used for Frame Extraction */}
      <video ref={offscreenVideoRef} style={{ display: "none" }} muted playsInline crossOrigin="anonymous" />
      <canvas ref={offscreenCanvasRef} style={{ display: "none" }} />

      {/* Header Bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
        borderBottom: "1px solid var(--panel-border)",
        paddingBottom: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(34, 211, 238, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)"
          }}>
            <Film size={20} strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              Offline Video AI Forensic Scanner & Interactive Timeline
              <span className="badge" style={{ background: "rgba(34, 211, 238, 0.15)", color: "var(--accent)", fontSize: "10.5px" }}>
                ANPR + Object Recognition
              </span>
            </h3>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-dim)" }}>
              Upload any recorded CCTV video to run deep learning ANPR & object detection, index time-stamped metadata, and jump to exact vehicle timestamps with real-time on-screen AI drawing.
            </p>
          </div>
        </div>

        {videoFile && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleExportCSV}
              disabled={detections.length === 0}
              style={{ fontSize: "11.5px", gap: "6px" }}
            >
              <Download size={13} /> Export Metadata CSV
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleReset}
              style={{ fontSize: "11.5px", gap: "5px" }}
            >
              <Trash2 size={13} /> Clear Video
            </button>
          </div>
        )}
      </div>

      {/* 1. Upload Video Zone (If no video selected) */}
      {!videoFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragOver ? "2px dashed var(--accent)" : "2px dashed var(--panel-border)",
            background: isDragOver ? "rgba(34, 211, 238, 0.12)" : "var(--input-bg)",
            borderRadius: "10px",
            padding: "42px 20px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px"
          }}
        >
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(34, 211, 238, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Upload size={26} strokeWidth={2} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)" }}>
            Drag & Drop Recorded CCTV Video File Here
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
            Supports <strong>MP4, WEBM, MOV, MKV, AVI</strong> · Max high-speed local frame extraction
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ marginTop: "6px", gap: "6px", fontWeight: 700 }}
          >
            <Upload size={13} /> Browse Video from Computer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.mkv,.avi"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />
        </div>
      ) : (
        /* Video Loaded Main Workspace */
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* Analysis Control & Progress Header */}
          <div style={{
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            borderRadius: "8px",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Film size={18} style={{ color: "var(--accent)" }} />
              <div>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                  {videoFile.name}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-dim)", marginLeft: "8px" }}>
                  ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB · Duration: {formatTime(videoDuration)})
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-dim)" }}>
                <span>Scan Step:</span>
                <select
                  value={scanIntervalSec}
                  onChange={(e) => setScanIntervalSec(parseFloat(e.target.value))}
                  disabled={isAnalyzing}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--panel-border)",
                    fontSize: "11.5px"
                  }}
                >
                  <option value={0.4}>High Precision (Every 0.4s)</option>
                  <option value={0.8}>Balanced (Every 0.8s)</option>
                  <option value={1.5}>Fast Scan (Every 1.5s)</option>
                </select>
              </div>

              {!isAnalyzing ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={startForensicScan}
                  style={{ gap: "6px", fontWeight: 700 }}
                >
                  <Sparkles size={14} /> Start AI Video Scan
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={cancelForensicScan}
                  style={{ gap: "6px" }}
                >
                  <AlertTriangle size={13} /> Stop Scanning
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar (During Analysis) */}
          {isAnalyzing && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--accent)", fontWeight: 700 }}>
                <span>{scanStatusText}</span>
                <span>{scanProgress}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--panel-border)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${scanProgress}%`, height: "100%", background: "var(--accent)", transition: "width 0.2s" }} />
              </div>
            </div>
          )}

          {/* Summary KPI Cards & Filters Bar (Upper Showcase Area) */}
          {detections.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              
              {/* Top KPI Ribbon */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                <div style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700 }}>Total Detections</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)" }}>{totalDetectionsCount}</div>
                </div>

                <div style={{ background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.3)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#eab308", fontWeight: 700 }}>Plates Recognized</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#eab308" }}>{plateCount}</div>
                </div>

                <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#0284c7", fontWeight: 700 }}>Vehicles Detected</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#0284c7" }}>{vehicleCount}</div>
                </div>

                <div style={{ background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.3)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#06b6d4", fontWeight: 700 }}>Persons / Pedestrians</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#06b6d4" }}>{personCount}</div>
                </div>

                <div style={{ background: watchlistHitsCount > 0 ? "rgba(239, 68, 68, 0.12)" : "var(--panel-bg)", border: watchlistHitsCount > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--panel-border)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: watchlistHitsCount > 0 ? "#ef4444" : "var(--text-dim)", fontWeight: 700 }}>Watchlist Hits</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: watchlistHitsCount > 0 ? "#ef4444" : "var(--text-dim)" }}>{watchlistHitsCount}</div>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", gap: "4px", background: "var(--input-bg)", padding: "3px", borderRadius: "6px", border: "1px solid var(--panel-border)" }}>
                  {[
                    { id: "all", label: `All (${totalDetectionsCount})` },
                    { id: "plates", label: `Plates (${plateCount})` },
                    { id: "vehicles", label: `Vehicles (${vehicleCount})` },
                    { id: "persons", label: `Persons (${personCount})` },
                    { id: "watchlist", label: `Watchlist (${watchlistHitsCount})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterType(tab.id)}
                      style={{
                        background: filterType === tab.id ? "var(--accent)" : "transparent",
                        color: filterType === tab.id ? "#000" : "var(--text-secondary)",
                        fontWeight: 700,
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--input-bg)", border: "1px solid var(--panel-border)", borderRadius: "6px", padding: "4px 10px", width: "240px" }}>
                  <Search size={13} style={{ color: "var(--text-dim)" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search plate or object..."
                    style={{ background: "transparent", border: "none", outline: "none", fontSize: "11.5px", color: "var(--text-primary)", width: "100%" }}
                  />
                </div>
              </div>

              {/* Horizontal Scrollable Detection Cards Stream (Click to Seek & Draw) */}
              <div style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                paddingBottom: "6px",
                maxHeight: "150px"
              }}>
                {filteredDetections.map((det) => {
                  const isSelected = selectedDetection && selectedDetection.id === det.id;
                  const isPlate = det.type === "PLATE";
                  return (
                    <div
                      key={det.id}
                      onClick={() => handleSelectDetection(det)}
                      style={{
                        width: "155px",
                        flexShrink: 0,
                        background: isSelected ? "rgba(34, 211, 238, 0.15)" : "var(--panel-bg)",
                        border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--panel-border)",
                        borderRadius: "6px",
                        padding: "6px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px"
                      }}
                      title="Click to seek video to this timestamp and draw AI bounding box"
                    >
                      {/* Thumbnail Snapshot */}
                      <div style={{ width: "100%", height: "55px", background: "#000", borderRadius: "4px", overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {det.snapshot ? (
                          <img src={det.snapshot} alt={det.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Film size={20} style={{ color: "var(--text-dim)" }} />
                        )}
                        <span style={{
                          position: "absolute",
                          bottom: "3px",
                          right: "3px",
                          background: "rgba(0,0,0,0.75)",
                          color: "#fff",
                          fontSize: "9.5px",
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: "3px",
                          fontFamily: "var(--font-mono)"
                        }}>
                          {det.timeFormatted}
                        </span>
                      </div>

                      {/* Label & Type Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: det.isWatchlist ? "#ef4444" : isPlate ? "#eab308" : "var(--text-primary)",
                          fontFamily: isPlate ? "var(--font-mono)" : "inherit",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {det.label}
                        </span>
                        <span style={{ fontSize: "9.5px", color: "var(--text-dim)", fontWeight: 700 }}>
                          {det.confidence}%
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9.5px", color: "var(--text-dim)" }}>
                        <span style={{ color: isPlate ? "#eab308" : "var(--accent)" }}>
                          {isPlate ? "HSRP Plate" : det.type}
                        </span>
                        {isSelected && (
                          <span style={{ color: "var(--accent)", fontWeight: 800 }}>● PLAYING</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Interactive Video Stage with Canvas Overlay */}
          <div style={{
            position: "relative",
            width: "100%",
            height: "420px",
            background: "#000",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            {/* HTML5 Video Player */}
            <video
              ref={videoRef}
              src={videoUrl}
              muted={isMuted}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block"
              }}
            />

            {/* High-Precision On-Screen AI Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 5
              }}
            />

            {/* Real-time Top Overlay HUD */}
            <div style={{
              position: "absolute",
              top: "10px",
              left: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(6px)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              zIndex: 6
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isPlaying ? "#22c55e" : "#eab308" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                {formatTime(currentTime, true)} / {formatTime(videoDuration)}
              </span>
              {selectedDetection && (
                <span style={{ fontSize: "10.5px", color: "var(--accent)", borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: "8px" }}>
                  Tracking: <strong>{selectedDetection.label}</strong>
                </span>
              )}
            </div>
          </div>

          {/* 3. High-Tech Timeline Scrubber with Detection Markers */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* Detection Marker Indicator Dots */}
            <div style={{ position: "relative", width: "100%", height: "8px", background: "var(--input-bg)", borderRadius: "4px", overflow: "hidden" }}>
              {videoDuration > 0 && detections.map(d => {
                const pct = (d.time / videoDuration) * 100;
                let dotColor = "#38bdf8";
                if (d.isWatchlist) dotColor = "#ef4444";
                else if (d.type === "PLATE") dotColor = "#eab308";
                return (
                  <div
                    key={d.id}
                    onClick={() => handleSelectDetection(d)}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      top: 0,
                      width: "3px",
                      height: "100%",
                      background: dotColor,
                      cursor: "pointer",
                      zIndex: 3
                    }}
                    title={`${d.type}: ${d.label} at ${d.timeFormatted}`}
                  />
                );
              })}
            </div>

            {/* Main Video Range Slider */}
            <input
              type="range"
              min={0}
              max={videoDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                width: "100%",
                accentColor: "var(--accent)",
                cursor: "pointer"
              }}
            />
          </div>

          {/* 4. Player Action Controls Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            borderRadius: "8px",
            padding: "8px 14px",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={togglePlay}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                    drawOverlayForTime(0);
                  }
                }}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Rewind to start"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setIsMuted(!isMuted)}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 700, marginLeft: "4px" }}>
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-dim)" }}>
                <span>Speed:</span>
                {[0.5, 1, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      setPlaybackRate(speed);
                      if (videoRef.current) videoRef.current.playbackRate = speed;
                    }}
                    style={{
                      background: playbackRate === speed ? "var(--accent)" : "var(--input-bg)",
                      color: playbackRate === speed ? "#000" : "var(--text-primary)",
                      border: "1px solid var(--panel-border)",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.requestFullscreen) {
                      videoRef.current.requestFullscreen();
                    }
                  }
                }}
                style={{ width: "32px", height: "32px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
