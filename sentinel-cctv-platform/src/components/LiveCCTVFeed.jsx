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

  // Extract clean stream ID / number
  const cleanId = camera ? (camera.id || "").replace("gov-feed-", "") : "1";
  
  // Resolve MediaMTX WebRTC Embed URL
  const resolveWebRtcUrl = useCallback((cam) => {
    if (!cam) return "";
    const id = (cam.id || "").replace("gov-feed-", "") || "1";
    const raw = cam.whep_url || (cam.urls && cam.urls.whep) || cam.stream_url || "";
    
    // If raw URL points to MediaMTX port 8889
    if (raw.includes(":8889/")) {
      const match = raw.match(/http:\/\/([^:/]+):8889\/(.+)/);
      if (match) {
        const host = match[1] || "localhost";
        let path = match[2].replace(/\/whep$/, "");
        return `http://${host}:8889/${path}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=${isDetailed ? 1 : 0}`;
      }
    }
    return `http://localhost:8889/stream/${id}/?autoplay=1&muted=${isMuted ? 1 : 0}&controls=${isDetailed ? 1 : 0}`;
  }, [isMuted, isDetailed]);

  const webRtcEmbedUrl = resolveWebRtcUrl(camera);
  const whepApiUrl = camera?.whep_url || (camera?.urls && camera.urls.whep) || `http://localhost:8889/stream/${cleanId}/whep`;
  const rawStreamUrl = camera ? (camera.stream_url || camera.rtsp_url || whepApiUrl) : "";
  const isRtspOnly = rawStreamUrl.toLowerCase().startsWith("rtsp://") && !camera?.whep_url;

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

    if (isMjpegPattern) {
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
    if (streamMode === "video") {
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
    setErrorMessage("Live snapshot/feed currently unavailable.");
  };

  if (!camera) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#050914", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
        No camera asset selected
      </div>
    );
  }

  const effectiveFallbackUrl = isRtspOnly
    ? `/api/v1/proxy-stream?url=${encodeURIComponent(rawStreamUrl)}`
    : (camera.hls_url || rawStreamUrl);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* 1. MediaMTX WebRTC Stream Embed */}
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

      {/* 2. HTML5 Video Player */}
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

      {/* Stream Protocol & Status Badge (Top-Left HUD) */}
      {!streamError && (
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

