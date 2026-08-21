import React, { useRef, useState, useEffect } from "react";
import { Video, AlertTriangle, RefreshCw, ExternalLink, Radio } from "lucide-react";

export const LiveCCTVFeed = ({
  camera,
  isMuted = true,
  isDetailed = false
}) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const [streamMode, setStreamMode] = useState("video"); // "video" (H264/MP4/WebM) or "mjpeg" (Flask/OpenCV/IPCam)
  const [streamError, setStreamError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const rawStreamUrl = camera ? (camera.stream_url || "") : "";
  const isRtsp = rawStreamUrl.toLowerCase().startsWith("rtsp://");
  
  // If RTSP, route through local proxy gateway or use direct URL for HTTP/HTTPS/HLS/MP4/MJPEG
  const effectiveStreamUrl = isRtsp
    ? `/api/v1/proxy-stream?url=${encodeURIComponent(rawStreamUrl)}`
    : rawStreamUrl;

  useEffect(() => {
    setStreamError(false);
    setIsLoading(true);

    if (!rawStreamUrl) {
      setIsLoading(false);
      return;
    }

    const lower = rawStreamUrl.toLowerCase();
    // Auto-detect MJPEG / Flask / Python OpenCV / IP Cam port streams
    if (
      lower.includes(":5000") ||
      lower.includes(":8080") ||
      lower.includes("mjpeg") ||
      lower.includes("mjpg") ||
      lower.includes("video_feed") ||
      lower.includes("snapshot") ||
      lower.includes("action=stream")
    ) {
      setStreamMode("mjpeg");
    } else {
      setStreamMode("video");
    }
  }, [camera, rawStreamUrl]);

  const handleVideoLoaded = () => {
    setIsLoading(false);
    setStreamError(false);
  };

  const handleVideoError = () => {
    // If video tag failed (e.g. MJPEG sent without standard header), fallback to img tag stream
    if (streamMode === "video") {
      console.log(`Video element failed for ${rawStreamUrl}, attempting MJPEG image stream mode...`);
      setStreamMode("mjpeg");
    } else {
      setIsLoading(false);
      setStreamError(true);
    }
  };

  const handleImgLoaded = () => {
    setIsLoading(false);
    setStreamError(false);
  };

  const handleImgError = () => {
    console.warn(`Stream load failed for camera ${camera?.id}:`, rawStreamUrl);
    setIsLoading(false);
    setStreamError(true);
  };

  const handleRetry = () => {
    setStreamError(false);
    setIsLoading(true);
    if (streamMode === "video" && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  if (!camera) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#050914", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
        No camera selected
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* 1. HTML5 Video Player (for MP4 / HLS / WebRTC / WebM) */}
      {effectiveStreamUrl && streamMode === "video" && (
        <video
          ref={videoRef}
          src={effectiveStreamUrl}
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
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
            display: streamError ? "none" : "block"
          }}
        />
      )}

      {/* 2. MJPEG Image Stream (for Python Flask :5000 / OpenCV / IP Cams) */}
      {effectiveStreamUrl && streamMode === "mjpeg" && (
        <img
          ref={imgRef}
          src={effectiveStreamUrl}
          alt={camera.name}
          onLoad={handleImgLoaded}
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

      {/* Loading Indicator */}
      {isLoading && !streamError && (
        <div style={{ position: "absolute", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--accent)" }}>
          <RefreshCw size={20} className="spin-animation" style={{ animation: "radarSpin 1.2s linear infinite" }} />
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>Connecting Stream...</span>
        </div>
      )}

      {/* Stream Offline / Connection Error State */}
      {streamError && (
        <div style={{ position: "relative", zIndex: 5, padding: "16px", textAlign: "center", color: "var(--text-secondary)", maxWidth: "85%" }}>
          <AlertTriangle size={24} style={{ color: "var(--warning)", marginBottom: "6px" }} />
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
            Stream Feed Offline / Unreachable
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", wordBreak: "break-all", margin: "4px 0 8px" }}>
            {rawStreamUrl || "No stream URL assigned"}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
            <button
              className="btn btn-sm"
              onClick={handleRetry}
              style={{ fontSize: "10.5px", padding: "3px 8px" }}
            >
              <RefreshCw size={11} /> Reconnect
            </button>
            {rawStreamUrl && (
              <a href={rawStreamUrl} target="_blank" rel="noreferrer">
                <button
                  className="btn btn-sm"
                  style={{ fontSize: "10.5px", padding: "3px 8px" }}
                >
                  <ExternalLink size={11} /> Direct Link
                </button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
