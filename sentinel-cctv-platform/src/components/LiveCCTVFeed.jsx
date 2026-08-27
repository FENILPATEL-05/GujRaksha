import React, { useRef, useState, useEffect, useCallback } from "react";
import { Video, AlertTriangle, RefreshCw, ExternalLink, Radio, Zap, ShieldCheck, Play } from "lucide-react";

export const LiveCCTVFeed = ({
  camera,
  isMuted = true,
  isDetailed = false
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

  // Resolve MediaMTX WebRTC Embed URL
  const resolveWebRtcUrl = useCallback((cam) => {
    if (!cam) return "";
    const cleanId = getCleanId(cam);
    let path = resolveStreamPath(cam);
    if (path === "stream" || path === "stream/") {
      path = `stream/${cleanId}`;
    }
    const rawWhep = cam.whep_url || (cam.urls && cam.urls.whep) || "";
    const rawRtsp = cam.rtsp_url || cam.stream_url || (cam.urls && cam.urls.rtsp) || "";
    const currentHost = typeof window !== "undefined" ? (window.location.hostname || "localhost") : "localhost";

    // 1. If explicit sandbox host live.corp8.cloud
    if (rawWhep && rawWhep.includes("live.corp8.cloud")) {
      return `http://live.corp8.cloud:8889/${path}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=${isDetailed ? 1 : 0}`;
    }

    // 2. If remote RTSP URL with specific host (like rtsp://live.corp8.cloud:8554/stream/2)
    if (rawRtsp && rawRtsp.includes("live.corp8.cloud")) {
      const match = rawRtsp.match(/rtsp:\/\/([^:/]+):?(\d*)\/(.+)/);
      if (match) {
        const host = match[1];
        let p = match[3];
        if (p === "stream") p = `stream/${cleanId}`;
        return `http://${host}:8889/${p}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=${isDetailed ? 1 : 0}`;
      }
    }

    // 3. Localhost / Local Server fallback
    return `http://${currentHost}:8889/${path}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=${isDetailed ? 1 : 0}`;
  }, [isMuted, isDetailed, resolveStreamPath, getCleanId]);

  // Resolve WHEP API endpoint
  const resolveWhepApiUrl = useCallback((cam) => {
    if (!cam) return "";
    const cleanId = getCleanId(cam);
    let path = resolveStreamPath(cam);
    if (path === "stream" || path === "stream/") {
      path = `stream/${cleanId}`;
    }
    const rawWhep = cam.whep_url || (cam.urls && cam.urls.whep) || "";
    const rawRtsp = cam.rtsp_url || cam.stream_url || "";
    if (rawWhep && (rawWhep.includes("live.corp8.cloud") || (!rawWhep.includes("localhost") && !rawWhep.includes("127.0.0.1")))) {
      return rawWhep;
    }
    if (rawRtsp && rawRtsp.includes("live.corp8.cloud")) {
      const match = rawRtsp.match(/rtsp:\/\/([^:/]+):?(\d*)\/(.+)/);
      if (match) return `http://${match[1]}:8889/${match[3]}/whep`;
    }
    const currentHost = typeof window !== "undefined" ? (window.location.hostname || "localhost") : "localhost";
    return `http://${currentHost}:8889/${path}/whep`;
  }, [resolveStreamPath, getCleanId]);

  const webRtcEmbedUrl = resolveWebRtcUrl(camera);
  const whepApiUrl = resolveWhepApiUrl(camera);
  const rawStreamUrl = camera ? (camera.stream_url || camera.rtsp_url || whepApiUrl) : "";
  const isRtspOnly = false;

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
    const isPhysicalLocalRtsp = rawStreamUrl.includes("192.168.") || rawStreamUrl.includes("10.") || rawStreamUrl.includes("172.") || rawStreamUrl.includes("admin:");

    if (isCorp8Sandbox) {
      setStreamMode("sandbox_video");
      setActiveProtocol("HTTPS Live Stream");
      setIsLoading(false);
    } else if (isPhysicalLocalRtsp) {
      // Physical IP camera (e.g. H.265 / 4K / RTSP) -> Stream via ultra-fast RTSP Proxy
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


  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* 1. Sandbox HTTPS Video Stream Player */}
      {streamMode === "sandbox_video" && (
        <video
          ref={videoRef}
          src={sandboxVideoUrl}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          controls={isDetailed}
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
            pointerEvents: isDetailed ? "auto" : "none"
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
          muted={isMuted}
          loop
          playsInline
          controls={isDetailed}
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

      {/* 3. MJPEG Image Stream */}
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

