import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import aiVisionSocket from "../services/aiVisionSocket.js";
import { DetectionCanvasOverlay } from "./DetectionCanvasOverlay.jsx";


export const LiveCCTVFeed = ({
  camera,
  isMuted = true,
  isDetailed = false,
  showAiVision = false
}) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  const [streamMode, setStreamMode] = useState("webrtc"); // "webrtc", "video", "mjpeg", "ai_stream"
  const [streamError, setStreamError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeProtocol, setActiveProtocol] = useState("WHEP WebRTC");
  const [preferAiStream, setPreferAiStream] = useState(false);


  // Real-time detections from AI Vision Engine (Drawn directly according to camera configuration)
  const [liveDetections, setLiveDetections] = useState([]);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [stageDimensions, setStageDimensions] = useState({ width: "100%", height: "100%" });

  // Calculate exact pixel dimensions of the active video area inside container (eliminating black bar offset)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateStageBox = () => {
      const cW = el.clientWidth;
      const cH = el.clientHeight;
      if (!cW || !cH) return;

      const targetAspect = videoAspect || (16 / 9);
      let width = cW;
      let height = width / targetAspect;

      if (height > cH) {
        height = cH;
        width = height * targetAspect;
      }

      setStageDimensions({
        width: `${Math.round(width)}px`,
        height: `${Math.round(height)}px`
      });
    };

    updateStageBox();
    const observer = new ResizeObserver(updateStageBox);
    observer.observe(el);

    return () => observer.disconnect();
  }, [videoAspect]);


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

  // Determine if AI Vision overlay should be drawn (Supports ANPR, Object Detection, Traffic Monitoring)
  const isAiActive = showAiVision || (
    !camera?.detection_mode ||
    (camera.detection_mode !== 'NO_AI' && camera.detection_mode !== 'GENERAL_SURVEILLANCE') ||
    !!camera.enable_object_detection ||
    camera.detection_mode === 'ANPR_DETECTION' ||
    camera.detection_mode === 'OBJECT_DETECTION' ||
    camera.detection_mode === 'ANPR'
  );


  // Single Shared WebSocket Engine for Real-Time AI Bounding Boxes
  useEffect(() => {
    // Reset all detections immediately on camera switch
    setLiveDetections([]);

    if (!isAiActive || !camera) {
      return;
    }

    const primaryCode = camera.camera_code || camera.id || "GJ-GOV-001";
    const subCodes = Array.from(new Set([
      primaryCode,
      camera.id,
      camera.camera_code,
      `cam-${camera.id}`,
      `gov-feed-${camera.id}`,
      String(camera.id || '').replace('gov-feed-', '')
    ].filter(Boolean)));

    let isSubscribed = true;
    let staleDetectionTimer = null;

    const resetStaleTimer = () => {
      if (staleDetectionTimer) clearTimeout(staleDetectionTimer);
      staleDetectionTimer = setTimeout(() => {
        if (isSubscribed) {
          setLiveDetections([]);
        }
      }, 1500);
    };

    const handleVisionFrame = (detections) => {
      if (!isSubscribed) return;
      setLiveDetections(detections || []);
      resetStaleTimer();
    };

    // Subscribe via single shared WebSocket singleton across all code aliases
    subCodes.forEach(code => aiVisionSocket.subscribe(code, handleVisionFrame));

    return () => {
      isSubscribed = false;
      setLiveDetections([]);
      if (staleDetectionTimer) clearTimeout(staleDetectionTimer);
      subCodes.forEach(code => aiVisionSocket.unsubscribe(code, handleVisionFrame));
    };
  }, [isAiActive, camera?.camera_code, camera?.id]);

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

    if (preferAiStream) {
      setStreamMode("ai_stream");
      setActiveProtocol("Live AI Stream (Sentinel Engine)");
      setIsLoading(false);
      return;
    }

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
  }, [camera?.id, rawStreamUrl, preferAiStream]);

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

  const aiSourceUrl = camera?.rtsp_url || camera?.stream_url || (camera?.urls && (camera.urls.rtsp || camera.urls.hls || camera.urls.whep)) || rawStreamUrl || "0";
  const aiStreamUrl = `${apiPrefix}/api/v1/ai/video_feed?source=${encodeURIComponent(aiSourceUrl)}&trails=true&dwell=false&zone=false`;


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
        shadow: '0 0 10px rgba(168, 185, 129, 0.5)',
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

  const handleMetadata = (e) => {
    if (e.target && e.target.videoWidth && e.target.videoHeight) {
      setVideoAspect(e.target.videoWidth / e.target.videoHeight);
    }
  };

  const handleImgLoaded = (e) => {
    if (e.target && e.target.naturalWidth && e.target.naturalHeight) {
      setVideoAspect(e.target.naturalWidth / e.target.naturalHeight);
    }
    setIsLoading(false);
    setIsPlaying(true);
    setStreamError(false);
  };

  // Strictly filter to license plates only for raw video overlay
  const displayDetections = useMemo(() => {
    if (!liveDetections || !Array.isArray(liveDetections)) return [];
    return liveDetections.filter((det) => {
      const cls = String(det.class_name || det.class || det.label || det.type || '').toLowerCase();
      return (
        det.type === 'PLATE' ||
        cls.includes('plate') ||
        cls.includes('anpr') ||
        !!det.plate ||
        !!det.plate_text
      );
    });
  }, [liveDetections]);



  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Unified Aspect-Ratio Video & AI Stage (Pixel-Locked to visible video) */}
      <div
        style={{
          position: "relative",
          width: stageDimensions.width,
          height: stageDimensions.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >

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
            onLoadedMetadata={handleMetadata}
            onLoadedData={handleVideoLoaded}
            onError={handleVideoError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
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
            onLoadedMetadata={handleMetadata}
            onLoadedData={handleVideoLoaded}
            onCanPlay={handleVideoLoaded}
            onPlaying={handleVideoLoaded}
            onError={handleVideoError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
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
            onLoad={handleImgLoaded}
            onError={handleImgError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              position: "relative",
              zIndex: 1,
              display: streamError ? "none" : "block"
            }}
          />
        )}

        {/* 5. Real-time Baked-in AI Stream (Matching Sentinel CCTV Registry Core Engine) */}
        {streamMode === "ai_stream" && (
          <img
            ref={imgRef}
            src={aiStreamUrl}
            alt={camera.name || "Live AI Stream"}
            onLoad={handleImgLoaded}
            onError={handleImgError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              position: "relative",
              zIndex: 1,
              display: streamError ? "none" : "block"
            }}
          />
        )}

        {/* 6. AI OBJECT DETECTION & BOUNDING BOX HUD OVERLAY (HTML5 Canvas 60FPS + DOM Overlay) */}
        {isAiActive && streamMode !== "ai_stream" && (
          <DetectionCanvasOverlay camera={camera} isPlaying={isPlaying} />
        )}

        {isAiActive && streamMode !== "ai_stream" && displayDetections.length > 0 && (

          <div
            className="ai-hud-overlay"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 15,
              overflow: "hidden"
            }}
          >
            {/* Render Bounding Boxes */}
            {displayDetections.map((det, idx) => {
              const style = getBoxStyle(det);
              let ymin = 0.2, xmin = 0.2, ymax = 0.6, xmax = 0.6;

              if (Array.isArray(det.normalized_box) && det.normalized_box.length === 4) {
                const [b0, b1, b2, b3] = det.normalized_box;
                // Standard Python ANPR worker sends [y1/h, x1/w, y2/h, x2/w] -> [ymin, xmin, ymax, xmax]
                ymin = Math.min(b0, b2);
                ymax = Math.max(b0, b2);
                xmin = Math.min(b1, b3);
                xmax = Math.max(b1, b3);
              } else if (Array.isArray(det.box) && det.box.length === 4) {
                const fw = det.frame_width || 1280;
                const fh = det.frame_height || 720;
                const [c0, c1, c2, c3] = det.box;

                if (c0 <= 1.05 && c1 <= 1.05 && c2 <= 1.05 && c3 <= 1.05) {
                  // Normalized [x1, y1, x2, y2]
                  xmin = Math.min(c0, c2);
                  xmax = Math.max(c0, c2);
                  ymin = Math.min(c1, c3);
                  ymax = Math.max(c1, c3);
                } else {
                  // Pixel coordinates [x1, y1, x2, y2] or [x, y, w, h]
                  let x1 = c0, y1 = c1, x2 = c2, y2 = c3;
                  if (x2 < x1) x2 = x1 + c2;
                  if (y2 < y1) y2 = y1 + c3;
                  xmin = Math.min(x1, x2) / fw;
                  xmax = Math.max(x1, x2) / fw;
                  ymin = Math.min(y1, y2) / fh;
                  ymax = Math.max(y1, y2) / fh;
                }
              }

              // Clamp safely within valid viewport boundaries
              ymin = Math.max(0.005, Math.min(0.97, ymin));
              xmin = Math.max(0.005, Math.min(0.97, xmin));
              ymax = Math.max(ymin + 0.02, Math.min(0.995, ymax));
              xmax = Math.max(xmin + 0.02, Math.min(0.995, xmax));

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
                    willChange: "top, left, width, height"
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
                    <span>{det.plate ? `🚘 ${det.plate}` : (det.label || 'OBJECT')}</span>
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
      </div>

      {/* Stream Protocol & Status Badge (Top-Left HUD - only in detailed modal) */}
      {isDetailed && !streamError && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 20,
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

      {/* Stream Switcher Toggle (Raw Feed vs Real-time Baked-in AI Stream) */}
      {!streamError && (
        <div style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 25,
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              setPreferAiStream(!preferAiStream);
            }}
            title={preferAiStream ? "Switch to Normal Raw Video Feed" : "Switch to Real-Time Baked-in AI Stream (Zero-Latency Sync)"}
            style={{
              fontSize: "10px",
              padding: "2px 7px",
              background: preferAiStream ? "rgba(16, 185, 129, 0.9)" : "rgba(15, 23, 42, 0.8)",
              border: preferAiStream ? "1px solid #10b981" : "1px solid rgba(255, 255, 255, 0.2)",
              color: "#fff",
              borderRadius: "5px",
              backdropFilter: "blur(6px)",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {preferAiStream ? "🎯 AI Stream (Sync)" : "🎥 Raw Stream"}
          </button>
        </div>
      )}


      {/* Loading Indicator */}
      {isLoading && !streamError && (
        <div style={{ position: "absolute", zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--accent)" }}>
          <RefreshCw size={22} className="spin-animation" style={{ animation: "radarSpin 1.2s linear infinite" }} />
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>Connecting WebRTC Stream...</span>
        </div>
      )}

      {/* Stream Offline / Connection Error State */}
      {streamError && (
        <div style={{ position: "relative", zIndex: 20, padding: "16px", textAlign: "center", color: "var(--text-secondary)", maxWidth: "88%" }}>
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


