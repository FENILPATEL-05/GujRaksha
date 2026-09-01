import React, { useRef, useState, useEffect, useCallback } from "react";
import { Video, AlertTriangle, RefreshCw, ExternalLink, Radio, Zap, ShieldCheck, Play, Eye, EyeOff, Sparkles, Car, User, Target } from "lucide-react";
import aiVisionSocket from "../services/aiVisionSocket.js";

export const LiveCCTVFeed = ({
  camera,
  isMuted = true,
  isDetailed = false,
  showAiVision = true
}) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const iframeRef = useRef(null);

  const [streamMode, setStreamMode] = useState("webrtc"); // "webrtc", "video", "mjpeg"
  const [streamError, setStreamError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeProtocol, setActiveProtocol] = useState("WHEP WebRTC");

  // AI Object Detection State (Active only when showAiVision=true)
  const [aiVisionEnabled, setAiVisionEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("gujraksha_ai_vision_boxes");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });
  const [liveDetections, setLiveDetections] = useState([]);
  const [detectionCounts, setDetectionCounts] = useState({ total: 0, vehicles: 0, persons: 0, plates: 0 });

  const getCleanId = useCallback((cam) => {
    if (!cam) return "1";
    if (cam.number !== undefined && cam.number !== null) return String(cam.number);
    const idStr = String(cam.id || "");
    const cleaned = idStr.replace("gov-feed-", "").replace("cam-", "").trim();
    return cleaned || "1";
  }, []);

  // Helper to extract the actual stream path (e.g., 'webcam' or 'stream/1')
  const resolveStreamPath = useCallback((cam) => {
    if (!cam) return "stream/1";
    const cleanId = getCleanId(cam);
    const raw = cam.whep_url || cam.rtsp_url || cam.stream_url || (cam.urls && (cam.urls.whep || cam.urls.rtsp)) || "";

    // If it's a MediaMTX URL with port 8554 or 8889
    if (raw.includes(":8554/") || raw.includes(":8889/")) {
      const match = raw.match(/:(?:8554|8889)\/([^?#]+)/);
      if (match) {
        let p = match[1].replace(/\/whep$/, "").replace(/\/$/, "");
        if (p === "stream" || p === "stream/") {
          p = `stream/${cleanId}`;
        }
        return p;
      }
    }

    // If raw URL is explicit custom path like rtsp://127.0.0.1:8554/webcam
    if (raw.endsWith("/webcam")) {
      return "webcam";
    }

    return `stream/${cleanId}`;
  }, [getCleanId]);

  const streamPath = resolveStreamPath(camera);

  // Resolve WHEP API endpoint
  const resolveWhepApiUrl = useCallback((cam) => {
    if (!cam) return "";
    const currentHost = typeof window !== "undefined" ? (window.location.hostname || "localhost") : "localhost";
    const sanitizeUrl = (u) => {
      if (!u) return u;
      if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        return u.replace("localhost", currentHost).replace("127.0.0.1", currentHost);
      }
      return u;
    };

    if (cam.whep_url && cam.whep_url.trim()) return sanitizeUrl(cam.whep_url.trim());
    if (cam.urls && cam.urls.whep && cam.urls.whep.trim()) return sanitizeUrl(cam.urls.whep.trim());
    if (cam.stream_url && (cam.stream_url.endsWith('/whep') || cam.stream_url.includes(':8889/'))) {
      return sanitizeUrl(cam.stream_url.trim());
    }
    
    if (cam.rtsp_url && (cam.rtsp_url.includes(':8554/') || cam.rtsp_url.includes('/stream/'))) {
      const match = cam.rtsp_url.match(/rtsp:\/\/(?:[^@]+@)?([^:/]+):?(\d*)\/(.+)/);
      if (match) {
        const hostPart = (match[1] === 'localhost' || match[1] === '127.0.0.1') ? currentHost : match[1];
        return `http://${hostPart}:8889/${match[3]}/whep`;
      }
    }

    const cleanId = getCleanId(cam);
    let path = resolveStreamPath(cam);
    if (path === "stream" || path === "stream/") {
      path = `stream/${cleanId}`;
    }
    return `http://${currentHost}:8889/${path}/whep`;
  }, [resolveStreamPath, getCleanId]);

  // Resolve MediaMTX WebRTC Embed URL (Never show timeline/controls)
  const resolveWebRtcUrl = useCallback((cam) => {
    if (!cam) return "";
    const whep = resolveWhepApiUrl(cam);
    if (whep) {
      const embedBase = whep.replace(/\/whep$/, "");
      return `${embedBase}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=0`;
    }
    const cleanId = getCleanId(cam);
    const currentHost = typeof window !== "undefined" ? (window.location.hostname || "localhost") : "localhost";
    return `http://${currentHost}:8889/stream/${cleanId}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=0`;
  }, [isMuted, resolveWhepApiUrl, getCleanId]);

  const webRtcEmbedUrl = resolveWebRtcUrl(camera);
  const whepApiUrl = resolveWhepApiUrl(camera);
  const rawStreamUrl = camera ? (camera.stream_url || camera.rtsp_url || whepApiUrl) : "";
  const isRtspOnly = false;

  useEffect(() => {
    try {
      localStorage.setItem("gujraksha_ai_vision_boxes", String(aiVisionEnabled));
    } catch {}
  }, [aiVisionEnabled]);

  // Single Shared WebSocket Engine for Real-Time AI Bounding Boxes
  useEffect(() => {
    // Reset all detections immediately on camera switch
    setLiveDetections([]);
    setDetectionCounts({ total: 0, vehicles: 0, persons: 0, plates: 0 });

    if (!showAiVision || !camera) {
      return;
    }
    const camCode = camera.camera_code || camera.id || "GJ-GOV-001";
    let isSubscribed = true;
    let staleDetectionTimer = null;

    const resetStaleTimer = () => {
      if (staleDetectionTimer) clearTimeout(staleDetectionTimer);
      staleDetectionTimer = setTimeout(() => {
        if (isSubscribed) {
          setLiveDetections([]);
          setDetectionCounts({ total: 0, vehicles: 0, persons: 0, plates: 0 });
        }
      }, 2200);
    };

    const handleVisionFrame = (detections, counts) => {
      if (!isSubscribed) return;
      setLiveDetections(detections || []);
      resetStaleTimer();
      if (counts) {
        setDetectionCounts(counts);
      } else {
        const list = detections || [];
        setDetectionCounts({
          total: list.length,
          vehicles: list.filter(d => ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE'].includes(String(d.label).toUpperCase())).length,
          persons: list.filter(d => String(d.label).toUpperCase() === 'PERSON').length,
          plates: list.filter(d => d.type === 'PLATE' || String(d.label).includes('PLATE')).length
        });
      }
    };

    // Subscribe via single shared WebSocket singleton
    aiVisionSocket.subscribe(camCode, handleVisionFrame);

    return () => {
      isSubscribed = false;
      setLiveDetections([]);
      setDetectionCounts({ total: 0, vehicles: 0, persons: 0, plates: 0 });
      if (staleDetectionTimer) clearTimeout(staleDetectionTimer);
      aiVisionSocket.unsubscribe(camCode, handleVisionFrame);
    };
  }, [showAiVision, camera?.camera_code, camera?.id]);

  // Dynamic Camera Stream Setup
  useEffect(() => {
    setStreamError(false);
    setIsLoading(true);
    setIsPlaying(true);

    if (!camera) {
      setIsLoading(false);
      return;
    }

    const lower = (rawStreamUrl || "").toLowerCase();
    const isMjpegPattern = (
      lower.includes(":5000") ||
      lower.includes(":8080") ||
      lower.includes("mjpeg") ||
      lower.includes("mjpg") ||
      lower.includes("video_feed") ||
      lower.includes("snapshot") ||
      lower.includes("action=stream")
    );

    const isCorp8Sandbox = (rawStreamUrl || "").includes("live.corp8.cloud") || (camera?.whep_url || "").includes("live.corp8.cloud");
    const hasExplicitWhep = !!(camera?.whep_url || camera?.urls?.whep || (rawStreamUrl && (rawStreamUrl.endsWith('/whep') || rawStreamUrl.includes(':8889/'))));
    const isPhysicalLocalRtsp = !hasExplicitWhep && (rawStreamUrl.includes("192.168.") || rawStreamUrl.includes("10.") || rawStreamUrl.includes("172.") || rawStreamUrl.includes("admin:"));

    if (isCorp8Sandbox) {
      setStreamMode("sandbox_video");
      setActiveProtocol("HTTPS Live Stream");
      setIsLoading(false);
    } else if (hasExplicitWhep) {
      setStreamMode("webrtc");
      setActiveProtocol("WHEP WebRTC");
      setIsLoading(false);
    } else if (isPhysicalLocalRtsp) {
      setStreamMode("mjpeg");
      setActiveProtocol("Live RTSP Stream Gateway");
      setIsLoading(false);
    } else if (isMjpegPattern) {
      setStreamMode("mjpeg");
      setActiveProtocol("MJPEG");
      setIsLoading(false);
    } else {
      setStreamMode("webrtc");
      setActiveProtocol("WHEP WebRTC");
      setIsLoading(false);
    }
  }, [camera?.id, rawStreamUrl]);

  const handleIframeLoaded = () => {
    setIsLoading(false);
    setIsPlaying(true);
    setStreamError(false);
  };

  const handleVideoLoaded = () => {
    setIsLoading(false);
    setIsPlaying(true);
    setStreamError(false);
  };

  const handleVideoError = () => {
    if (streamMode === "video" || streamMode === "sandbox_video") {
      setStreamMode("mjpeg");
      setActiveProtocol("MJPEG Fallback");
    } else {
      setIsLoading(false);
      setStreamError(true);
      setErrorMessage("Live stream connection failed.");
    }
  };

  const handleImgError = () => {
    setIsLoading(false);
    setStreamError(true);
    setErrorMessage("Live camera stream is buffering or offline.");
  };

  if (!camera) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#050914", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
        No camera asset selected
      </div>
    );
  }

  const cleanNumId = getCleanId(camera);
  const sandboxVideoUrl = `https://live.corp8.cloud/stream/${cleanNumId}`;
  const apiPrefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/gujraksha') ? '/gujraksha' : '';
  const rtspProxyUrl = `${apiPrefix}/api/v1/proxy-stream?url=${encodeURIComponent(camera?.stream_url || camera?.rtsp_url || '')}`;

  const effectiveFallbackUrl = (rawStreamUrl.startsWith('rtsp://') || isRtspOnly)
    ? rtspProxyUrl
    : (camera.hls_url || rawStreamUrl);

  // Helper to get color style for detected object classes
  const getBoxStyle = (det) => {
    const lbl = String(det.label || '').toUpperCase();
    const isWatchlist = !!det.is_watchlist_hit || lbl.includes('WATCHLIST');
    const isPlate = det.type === 'PLATE' || lbl.includes('PLATE');
    const isPerson = lbl.includes('PERSON');
    const isTwoWheeler = lbl.includes('MOTORCYCLE') || lbl.includes('BICYCLE') || lbl.includes('BIKE');

    if (isWatchlist) {
      return {
        borderColor: '#ef4444',
        badgeBg: '#dc2626',
        textColor: '#ffffff',
        shadow: '0 0 12px rgba(239, 68, 68, 0.6)',
        bg: 'rgba(239, 68, 68, 0.12)',
        icon: '🚨'
      };
    }
    if (isPlate) {
      return {
        borderColor: '#10b981',
        badgeBg: '#059669',
        textColor: '#ffffff',
        shadow: '0 0 10px rgba(16, 185, 129, 0.5)',
        bg: 'rgba(16, 185, 129, 0.12)',
        icon: '🎯'
      };
    }
    if (isPerson) {
      return {
        borderColor: '#f59e0b',
        badgeBg: '#d97706',
        textColor: '#ffffff',
        shadow: '0 0 10px rgba(245, 158, 11, 0.5)',
        bg: 'rgba(245, 158, 11, 0.10)',
        icon: '👤'
      };
    }
    if (isTwoWheeler) {
      return {
        borderColor: '#a855f7',
        badgeBg: '#9333ea',
        textColor: '#ffffff',
        shadow: '0 0 10px rgba(168, 85, 247, 0.5)',
        bg: 'rgba(168, 85, 247, 0.10)',
        icon: '🏍️'
      };
    }
    // Default Vehicles (Car, Bus, Truck)
    return {
      borderColor: '#06b6d4',
      badgeBg: '#0891b2',
      textColor: '#ffffff',
      shadow: '0 0 10px rgba(6, 182, 212, 0.5)',
      bg: 'rgba(6, 182, 212, 0.10)',
      icon: lbl.includes('TRUCK') ? '🚚' : (lbl.includes('BUS') ? '🚌' : '🚗')
    };
  };

  // Only real detections from live AI models (No mock/random data!)
  const displayDetections = liveDetections || [];

  const totalVehicleCount = displayDetections.filter(d => ['CAR', 'TRUCK', 'BUS', 'MOTORCYCLE', 'BICYCLE', 'VEHICLE'].some(k => String(d.label).toUpperCase().includes(k))).length;
  const totalPlateCount = displayDetections.filter(d => d.type === 'PLATE' || String(d.label).includes('PLATE')).length;
  const totalPersonCount = displayDetections.filter(d => String(d.label).toUpperCase().includes('PERSON')).length;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* 1. Direct MP4 / Static Sandbox Feeds */}
      {streamMode === "sandbox_video" && (
        <video
          ref={videoRef}
          src={sandboxVideoUrl}
          autoPlay
          muted={true}
          loop
          playsInline
          controls={false}
          onLoadedData={handleVideoLoaded}
          onError={handleVideoError}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "relative",
            zIndex: 1,
            display: streamError ? "none" : "block"
          }}
        />
      )}

      {/* 2. MediaMTX WebRTC Stream Embed */}
      {streamMode === "webrtc" && (
        <iframe
          ref={iframeRef}
          src={webRtcEmbedUrl}
          title={camera.name || "Live CCTV"}
          onLoad={handleIframeLoaded}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "#000",
            position: "relative",
            zIndex: 1,
            display: streamError ? "none" : "block",
            pointerEvents: "none"
          }}
          allow="autoplay; fullscreen"
        />
      )}

      {/* 3. HTML5 Fallback Video Player */}
      {streamMode === "video" && (
        <video
          ref={videoRef}
          src={effectiveFallbackUrl}
          autoPlay
          muted={true}
          loop
          playsInline
          controls={false}
          onLoadedData={handleVideoLoaded}
          onCanPlay={handleVideoLoaded}
          onPlaying={handleVideoLoaded}
          onError={handleVideoError}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
            display: streamError ? "none" : "block"
          }}
        />
      )}

      {/* 4. MJPEG Image Stream */}
      {streamMode === "mjpeg" && (
        <img
          ref={imgRef}
          src={effectiveFallbackUrl}
          alt={camera.name}
          onError={handleImgError}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
            display: streamError ? "none" : "block"
          }}
        />
      )}

      {/* 5. AI OBJECT DETECTION & BOUNDING BOX HUD OVERLAY (Only for Single Camera with showAiVision=true) */}
      {showAiVision && aiVisionEnabled && (
        <div
          className="ai-hud-overlay"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 15,
            overflow: "hidden"
          }}
        >
          {/* Render Bounding Boxes */}
          {displayDetections.map((det, idx) => {
            const style = getBoxStyle(det);
            let norm = det.normalized_box;
            if (!norm && det.box && Array.isArray(det.box) && det.box.length === 4) {
              const fw = det.frame_width || 1280;
              const fh = det.frame_height || 720;
              norm = [det.box[1] / fh, det.box[0] / fw, det.box[3] / fh, det.box[2] / fw];
            }
            if (!norm) norm = [0.2, 0.2, 0.6, 0.6];
            const ymin = Math.max(0.01, Math.min(0.96, norm[0]));
            const xmin = Math.max(0.01, Math.min(0.96, norm[1]));
            const ymax = Math.max(ymin + 0.03, Math.min(0.99, norm[2]));
            const xmax = Math.max(xmin + 0.03, Math.min(0.99, norm[3]));

            const topPct = `${(ymin * 100).toFixed(2)}%`;
            const leftPct = `${(xmin * 100).toFixed(2)}%`;
            const widthPct = `${((xmax - xmin) * 100).toFixed(2)}%`;
            const heightPct = `${((ymax - ymin) * 100).toFixed(2)}%`;

            return (
              <div
                key={`bbox-${idx}-${det.label || 'obj'}`}
                className="ai-bbox-box"
                style={{
                  top: topPct,
                  left: leftPct,
                  width: widthPct,
                  height: heightPct,
                  border: `1.5px solid ${style.borderColor}`,
                  background: style.bg,
                  boxShadow: style.shadow,
                  position: "absolute",
                  transition: "top 0.15s cubic-bezier(0.25, 0.1, 0.25, 1.0), left 0.15s cubic-bezier(0.25, 0.1, 0.25, 1.0), width 0.15s cubic-bezier(0.25, 0.1, 0.25, 1.0), height 0.15s cubic-bezier(0.25, 0.1, 0.25, 1.0)"
                }}
              >
                {/* 4-Corner Reticle Brackets */}
                <span className="ai-bbox-corner ai-bbox-tl" style={{ borderColor: style.borderColor }} />
                <span className="ai-bbox-corner ai-bbox-tr" style={{ borderColor: style.borderColor }} />
                <span className="ai-bbox-corner ai-bbox-bl" style={{ borderColor: style.borderColor }} />
                <span className="ai-bbox-corner ai-bbox-br" style={{ borderColor: style.borderColor }} />

                {/* Top Pill Badge Label */}
                <div
                  className="ai-bbox-badge"
                  style={{
                    background: style.badgeBg,
                    color: style.textColor,
                    border: `1px solid ${style.borderColor}`
                  }}
                >
                  <span>{style.icon}</span>
                  <span>{det.label || 'OBJECT'}</span>
                  {det.confidence && (
                    <span style={{ opacity: 0.9, fontSize: '9px', fontWeight: 600 }}>
                      {Math.round(det.confidence)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top-Right AI Vision HUD Controls & Live Object Counters (Only when showAiVision=true) */}
      {showAiVision && (
        <div
          className="ai-hud-toolbar"
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 25,
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {/* Live Object Counts Pill */}
          {aiVisionEnabled && (
            <div className="ai-hud-counts-badge">
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }} />
              <span>{totalVehicleCount} Vehicles</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span>{totalPlateCount} Plates</span>
              {totalPersonCount > 0 && (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>{totalPersonCount} Persons</span>
                </>
              )}
            </div>
          )}

          {/* AI Vision Toggle Button */}
          <button
            className={`ai-hud-toggle-btn ${aiVisionEnabled ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setAiVisionEnabled(!aiVisionEnabled);
            }}
            title="Toggle AI Object & Plate Detection Bounding Boxes"
          >
            {aiVisionEnabled ? <Eye size={12} strokeWidth={2.4} /> : <EyeOff size={12} strokeWidth={2.4} />}
            <span>AI Vision {aiVisionEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}

      {/* Stream Protocol & Status Badge (Top-Left HUD - only in detailed modal) */}
      {isDetailed && !streamError && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 6,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(10, 15, 29, 0.8)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "10.5px",
          fontWeight: 700,
          color: isPlaying ? "var(--success)" : "var(--accent)"
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: isPlaying ? "#10b981" : "var(--accent)",
            boxShadow: isPlaying ? "0 0 6px #10b981" : "none",
            display: "inline-block"
          }} />
          <span>{activeProtocol}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && !streamError && (
        <div style={{ position: "absolute", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--accent)" }}>
          <RefreshCw size={22} className="spin-animation" style={{ animation: "radarSpin 1.2s linear infinite" }} />
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>Connecting WebRTC Stream...</span>
        </div>
      )}

      {/* Stream Offline / Connection Error State */}
      {streamError && (
        <div style={{ position: "relative", zIndex: 5, padding: "16px", textAlign: "center", color: "var(--text-secondary)", maxWidth: "88%" }}>
          <AlertTriangle size={26} style={{ color: "var(--warning)", marginBottom: "6px" }} />
          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
            Stream Feed Offline / Unreachable
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", wordBreak: "break-all", margin: "4px 0 8px" }}>
            {whepApiUrl || rawStreamUrl || "No stream URL configured"}
          </div>
          {errorMessage && (
            <div style={{ fontSize: "10px", color: "var(--danger)", marginBottom: "10px" }}>
              {errorMessage}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setStreamError(false);
                setIsLoading(true);
                if (iframeRef.current) {
                  iframeRef.current.src = webRtcEmbedUrl;
                }
              }}
              style={{ fontSize: "10.5px", padding: "3px 10px", gap: "4px" }}
            >
              <RefreshCw size={12} /> Retry Stream
            </button>
            <button
              className="btn btn-sm"
              onClick={() => window.open(webRtcEmbedUrl, '_blank')}
              style={{ fontSize: "10.5px", padding: "3px 10px", gap: "4px" }}
            >
              <ExternalLink size={12} /> Open Direct Stream
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


