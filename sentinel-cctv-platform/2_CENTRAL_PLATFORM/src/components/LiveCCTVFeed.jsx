import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, RefreshCw, ExternalLink, WifiOff, VideoOff, Radio, Play, Activity } from "lucide-react";
import aiVisionSocket from "../services/aiVisionSocket.js";
import { DetectionCanvasOverlay } from "./DetectionCanvasOverlay.jsx";

export const LiveCCTVFeed = ({
  camera,
  isMuted = true,
  isDetailed = false,
  showAiVision = false,
  defaultAiStream = false,
  allowAiStreamControls = false,
  preferAiStream: preferAiStreamProp,
  enableObjDetection: enableObjDetectionProp,
  enablePlateDetection: enablePlateDetectionProp,
  selectedClasses: selectedClassesProp
}) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const abortControllerRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const retryTimerRef = useRef(null);

  const [streamMode, setStreamMode] = useState("webrtc"); // "webrtc", "video", "sandbox_video", "mjpeg", "ai_stream"
  const [streamError, setStreamError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeProtocol, setActiveProtocol] = useState("WHEP WebRTC");
  const [retryCountdown, setRetryCountdown] = useState(5);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const [preferAiStream, setPreferAiStream] = useState(
    preferAiStreamProp !== undefined ? preferAiStreamProp : (allowAiStreamControls && defaultAiStream)
  );

  const [enableObjDetection, setEnableObjDetection] = useState(
    enableObjDetectionProp !== undefined ? enableObjDetectionProp : true
  );
  const [enablePlateDetection, setEnablePlateDetection] = useState(
    enablePlateDetectionProp !== undefined ? enablePlateDetectionProp : true
  );
  const [selectedClasses, setSelectedClasses] = useState(
    selectedClassesProp !== undefined ? selectedClassesProp : {
      person: true,
      car: true,
      bike: true,
      truck_bus: true,
      other: true
    }
  );

  useEffect(() => {
    if (preferAiStreamProp !== undefined) {
      setPreferAiStream(preferAiStreamProp);
    }
  }, [preferAiStreamProp]);

  useEffect(() => {
    if (enableObjDetectionProp !== undefined) {
      setEnableObjDetection(enableObjDetectionProp);
    }
  }, [enableObjDetectionProp]);

  useEffect(() => {
    if (enablePlateDetectionProp !== undefined) {
      setEnablePlateDetection(enablePlateDetectionProp);
    }
  }, [enablePlateDetectionProp]);

  useEffect(() => {
    if (selectedClassesProp !== undefined) {
      setSelectedClasses(selectedClassesProp);
    }
  }, [selectedClassesProp]);

  // Real-time detections from AI Vision Engine
  const [liveDetections, setLiveDetections] = useState([]);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [stageDimensions, setStageDimensions] = useState({ width: "100%", height: "100%" });

  // Calculate exact pixel dimensions of the active video area inside container
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

  const resolveStreamPath = useCallback((cam) => {
    if (!cam) return "stream/cam01";
    const cleanId = getCleanId(cam);
    const raw = cam.whep_url || cam.rtsp_url || cam.stream_url || (cam.urls && (cam.urls.whep || cam.urls.rtsp)) || "";

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

    if (raw.endsWith("/webcam")) {
      return "webcam";
    }

    const paddedId = String(cleanId).startsWith('cam') ? cleanId : (String(cleanId).length === 1 ? `cam0${cleanId}` : `cam${cleanId}`);
    return `stream/${paddedId}`;
  }, [getCleanId]);

  const resolveWhepApiUrl = useCallback((cam) => {
    if (!cam) return "";
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const apiPrefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/gujraksha') ? '/gujraksha' : '';

    let directWhep = (cam.whep_url || (cam.urls && cam.urls.whep) || '').trim();
    if (!directWhep && (cam.rtsp_url || cam.stream_url)) {
      const streamPath = resolveStreamPath(cam);
      directWhep = `http://fenil.patel@nxon.io:WWL7-E6HY-ZC54@103.250.160.189:8889/${streamPath}/whep`;
    }

    if (!directWhep) {
      const streamPath = resolveStreamPath(cam);
      directWhep = `http://fenil.patel@nxon.io:WWL7-E6HY-ZC54@103.250.160.189:8889/${streamPath}/whep`;
    }

    // On HTTPS, route through backend proxy endpoint to avoid Mixed Content block
    if (isHttps) {
      return `${apiPrefix}/api/v1/proxy-whep?url=${encodeURIComponent(directWhep)}`;
    }
    return directWhep;
  }, [resolveStreamPath]);

  const whepApiUrl = resolveWhepApiUrl(camera);
  const rawStreamUrl = camera ? (camera.stream_url || camera.rtsp_url || whepApiUrl) : "";
  const isAiActive = Boolean(showAiVision && streamMode !== "ai_stream");

  // Single Shared WebSocket Engine for Real-Time AI Bounding Boxes
  useEffect(() => {
    setLiveDetections([]);
    if (!isAiActive || !camera) return;

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

    subCodes.forEach(code => aiVisionSocket.subscribe(code, handleVisionFrame));

    return () => {
      isSubscribed = false;
      setLiveDetections([]);
      if (staleDetectionTimer) clearTimeout(staleDetectionTimer);
      subCodes.forEach(code => aiVisionSocket.unsubscribe(code, handleVisionFrame));
    };
  }, [isAiActive, camera?.camera_code, camera?.id]);

  // Clean-up WebRTC PeerConnection
  const cleanupWebRtc = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Connect via Standard WebRTC WHEP HTTP Protocol (No iframes = No browser error pages)
  const startWhepConnection = useCallback(async (whepUrl) => {
    cleanupWebRtc();
    if (!whepUrl) throw new Error("No WHEP endpoint URL");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    peerConnectionRef.current = pc;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      if (videoRef.current) {
        if (event.streams && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        } else if (event.track) {
          videoRef.current.srcObject = new MediaStream([event.track]);
        }
        videoRef.current.play().catch(() => {});
        setIsLoading(false);
        setIsPlaying(true);
        setStreamError(false);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setIsLoading(false);
        setIsPlaying(true);
        setStreamError(false);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setIsLoading(false);
        setStreamError(true);
        setErrorMessage("WebRTC stream connection lost.");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidate gathering (ensures MediaMTX receives client network routes)
    await new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", checkState);
        setTimeout(resolve, 600);
      }
    });

    const sdpToSend = pc.localDescription ? pc.localDescription.sdp : offer.sdp;

    const authHeaders = {
      "Content-Type": "application/sdp",
      "Authorization": "Basic " + btoa("fenil.patel@nxon.io:WWL7-E6HY-ZC54")
    };

    const res = await fetch(whepUrl, {
      method: "POST",
      headers: authHeaders,
      body: sdpToSend,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`WHEP endpoint HTTP status: ${res.status}`);
    }

    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  }, [cleanupWebRtc]);

  // Main Stream Initializer & Auto-Fallback Manager
  const initStream = useCallback(async () => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);

    setStreamError(false);
    setIsLoading(true);
    setIsPlaying(false);
    setErrorMessage("");

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

    // Connection Timeout Guard (If no frames arrive in 6.5s -> show friendly Connection Lost overlay)
    connectTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setStreamError(true);
      setErrorMessage("Stream negotiation timed out. Camera feed may be initializing.");
    }, 6500);

    if (preferAiStream) {
      setStreamMode("ai_stream");
      setActiveProtocol("Live AI Stream (Sentinel Engine)");
      return;
    }

    if (isCorp8Sandbox) {
      setStreamMode("sandbox_video");
      setActiveProtocol("HTTPS Video Stream");
    } else if (hasExplicitWhep || (!isMjpegPattern && !rawStreamUrl.startsWith("rtsp://"))) {
      setStreamMode("webrtc");
      setActiveProtocol("WHEP WebRTC (Ultra Low Latency)");
      try {
        await startWhepConnection(whepApiUrl);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn("WHEP connection offline/404, using fallback gateway stream:", err.message);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setStreamError(false);
        // Fallback to video / RTSP proxy / MJPEG
        if (camera.hls_url) {
          setStreamMode("video");
          setActiveProtocol("HLS Live Feed");
        } else {
          setStreamMode("mjpeg");
          setActiveProtocol("Live Stream Gateway");
        }
      }
    } else if (isMjpegPattern) {
      setStreamMode("mjpeg");
      setActiveProtocol("MJPEG Stream");
    } else {
      setStreamMode("mjpeg");
      setActiveProtocol("Live Stream Gateway");
    }
  }, [camera, rawStreamUrl, preferAiStream, startWhepConnection, whepApiUrl]);

  // Trigger init on camera or stream change or retry
  useEffect(() => {
    initStream();
    return () => {
      cleanupWebRtc();
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, [camera?.id, rawStreamUrl, preferAiStream, retryAttempt]);

  // Auto-Retry Countdown Timer when stream error occurs
  useEffect(() => {
    if (!streamError) {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      return;
    }

    setRetryCountdown(5);
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(retryTimerRef.current);
          setRetryAttempt((a) => a + 1);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, [streamError]);

  const handleManualRetry = (e) => {
    if (e) e.stopPropagation();
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    setRetryAttempt((a) => a + 1);
  };

  const handleVideoLoaded = () => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    setIsLoading(false);
    setIsPlaying(true);
    setStreamError(false);
  };

  const handleVideoError = () => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    if (streamMode === "sandbox_video" || streamMode === "video") {
      setStreamMode("mjpeg");
      setActiveProtocol("MJPEG Fallback");
    } else {
      setIsLoading(false);
      setStreamError(true);
      setErrorMessage("Live video stream error.");
    }
  };

  const handleImgLoaded = () => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    setIsLoading(false);
    setIsPlaying(true);
    setStreamError(false);
  };

  const handleImgError = () => {
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    setIsLoading(false);
    setStreamError(true);
    setErrorMessage("Live camera stream is buffering or offline.");
  };

  const handleMetadata = (e) => {
    if (e.target && e.target.videoWidth && e.target.videoHeight) {
      setVideoAspect(e.target.videoWidth / e.target.videoHeight);
    }
  };

  if (!camera) {
    return (
      <div style={{ width: "100%", height: "100%", background: "#050914", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "12px" }}>
        No camera asset selected
      </div>
    );
  }

  const cleanNumId = getCleanId(camera);
  const sandboxVideoUrl = `https://live.corp8.cloud/stream/${cleanNumId}`;
  const apiPrefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/gujraksha') ? '/gujraksha' : '';
  const rtspProxyUrl = `${apiPrefix}/api/v1/proxy-stream?url=${encodeURIComponent(camera?.stream_url || camera?.rtsp_url || '')}`;

  const isAnprCamera = !!(camera?.detection_mode === 'ANPR' || camera?.detection_mode === 'AI_ANPR' || camera?.ai_type === 'anpr' || (camera?.stream_properties && camera.stream_properties.enable_anpr));
  const camId = camera?.id || camera?.camera_code || 'cam-1';
  const camCode = camera?.camera_code || camera?.id || 'GJ-GOV-001';
  const currentHostForAi = typeof window !== "undefined" ? (window.location.hostname || "localhost") : "localhost";
  const sanitizeHost = (str) => {
    if (!str || typeof str !== 'string') return str;
    if (currentHostForAi && currentHostForAi !== "localhost" && currentHostForAi !== "127.0.0.1") {
      return str.split("localhost").join(currentHostForAi).split("127.0.0.1").join(currentHostForAi);
    }
    return str;
  };

  const rawAiSource = camera?.rtsp_url || camera?.stream_url || (camera?.urls && (camera.urls.rtsp || camera.urls.hls || camera.urls.whep)) || rawStreamUrl || "0";
  const rawAiFallback = camera?.hls_url || (camera?.urls && (camera.urls.hls || camera.urls.whep)) || (camera?.stream_url && !camera.stream_url.startsWith('rtsp://') ? camera.stream_url : '') || rawStreamUrl || "";
  const aiSourceUrl = sanitizeHost(rawAiSource);
  const aiFallbackUrl = sanitizeHost(rawAiFallback);
  const aiStreamUrl = `${apiPrefix}/api/v1/ai/video_feed?source=${encodeURIComponent(aiSourceUrl)}&fallback=${encodeURIComponent(aiFallbackUrl)}&camera_id=${encodeURIComponent(camId)}&camera_code=${encodeURIComponent(camCode)}&is_anpr=${isAnprCamera}&detect_objects=${enableObjDetection}&detect_plates=${enablePlateDetection}&trails=${enableObjDetection}&dwell=false&zone=false`;

  // Reactively broadcast AI controls to Python Stream Service whenever filters or detection toggles change
  useEffect(() => {
    try {
      fetch(`${apiPrefix}/api/v1/ai/stream_controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: aiSourceUrl,
          camera_id: camId,
          camera_code: camCode,
          detect_objects: Boolean(enableObjDetection),
          detect_plates: Boolean(enablePlateDetection),
          trails: Boolean(enableObjDetection),
          classes: selectedClasses
        })
      }).catch(() => {});
    } catch (_) {}
  }, [enableObjDetection, enablePlateDetection, selectedClasses, apiPrefix, aiSourceUrl, camId, camCode]);

  const handleToggleObjects = useCallback((e) => {
    if (e) e.stopPropagation();
    const nextVal = !enableObjDetection;
    setEnableObjDetection(nextVal);
  }, [enableObjDetection]);

  const handleTogglePlates = useCallback((e) => {
    if (e) e.stopPropagation();
    const nextVal = !enablePlateDetection;
    setEnablePlateDetection(nextVal);
  }, [enablePlateDetection]);

  const handleToggleClass = useCallback((classKey, e) => {
    if (e) e.stopPropagation();
    setSelectedClasses(prev => ({ ...prev, [classKey]: !prev[classKey] }));
  }, []);

  const actualRtspUrl = camera?.rtsp_url || camera?.stream_url || (camera?.urls && camera.urls.rtsp) || '';
  const effectiveFallbackUrl = (actualRtspUrl && actualRtspUrl.startsWith('rtsp://'))
    ? `${apiPrefix}/api/v1/proxy-stream?url=${encodeURIComponent(actualRtspUrl)}`
    : (camera.hls_url || (rawStreamUrl && !rawStreamUrl.includes(':8889/') && !rawStreamUrl.endsWith('/whep') ? rawStreamUrl : `${apiPrefix}/api/v1/proxy-stream?url=${encodeURIComponent(actualRtspUrl || 'rtsp://localhost:8554/stream/' + cleanNumId)}`));

  const getBoxStyle = (det) => {
    const lbl = String(det.label || '').toUpperCase();
    const isWatchlist = !!det.is_watchlist_hit || lbl.includes('WATCHLIST');
    const isPlate = det.type === 'PLATE' || lbl.includes('PLATE');

    if (isWatchlist) {
      return {
        borderColor: '#ef4444',
        badgeBg: '#dc2626',
        textColor: '#ffffff',
        shadow: '0 0 12px rgba(239, 68, 68, 0.6)',
        bg: 'rgba(239, 68, 68, 0.12)'
      };
    }
    if (isPlate) {
      return {
        borderColor: '#10b981',
        badgeBg: '#059669',
        textColor: '#ffffff',
        shadow: '0 0 10px rgba(16, 185, 129, 0.5)',
        bg: 'rgba(16, 185, 129, 0.1)'
      };
    }
    return {
      borderColor: '#38bdf8',
      badgeBg: '#0284c7',
      textColor: '#ffffff',
      shadow: '0 0 8px rgba(56, 189, 248, 0.4)',
      bg: 'rgba(56, 189, 248, 0.08)'
    };
  };

  const displayDetections = useMemo(() => {
    if (!liveDetections || !Array.isArray(liveDetections)) return [];
    const seen = new Set();
    const unique = [];
    for (const det of liveDetections) {
      const cls = String(det.class_name || det.class || det.label || det.type || '').toLowerCase();
      const isPlate = (
        det.type === 'PLATE' ||
        cls.includes('plate') ||
        cls.includes('anpr') ||
        Boolean(det.plate) ||
        Boolean(det.plate_text)
      );
      if (!isPlate) continue;

      const pTxt = (det.plate || det.plate_text || det.label || '').trim().toUpperCase();
      const bKey = Array.isArray(det.normalized_box)
        ? det.normalized_box.map(n => Math.round(n * 20)).join('_')
        : (Array.isArray(det.box) ? det.box.map(n => Math.round(n / 20)).join('_') : '');
      const key = `${pTxt}_${bKey}`;

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(det);
    }
    return unique;
  }, [liveDetections]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#030712",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Unified Aspect-Ratio Video & AI Stage */}
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
        {/* 1. Direct WebRTC WHEP Feed (Pure HTML5 Video - No Iframes) */}
        {streamMode === "webrtc" && (
          <video
            ref={videoRef}
            autoPlay
            muted={isMuted}
            playsInline
            controls={false}
            onLoadedMetadata={handleMetadata}
            onLoadedData={handleVideoLoaded}
            onPlaying={handleVideoLoaded}
            onCanPlay={handleVideoLoaded}
            onError={handleVideoError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              position: "relative",
              zIndex: 1,
              display: streamError || isLoading ? "none" : "block"
            }}
          />
        )}

        {/* 2. Direct MP4 / Static Sandbox Feeds */}
        {streamMode === "sandbox_video" && (
          <video
            ref={videoRef}
            src={sandboxVideoUrl}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            controls={false}
            onLoadedMetadata={handleMetadata}
            onLoadedData={handleVideoLoaded}
            onPlaying={handleVideoLoaded}
            onError={handleVideoError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              position: "relative",
              zIndex: 1,
              display: streamError || isLoading ? "none" : "block"
            }}
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
              display: streamError || isLoading ? "none" : "block"
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
              display: streamError || isLoading ? "none" : "block"
            }}
          />
        )}

        {/* 5. Real-time AI Stream */}
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
              display: streamError || isLoading ? "none" : "block"
            }}
          />
        )}

        {/* 6. AI Detection Canvas Overlay */}
        {isAiActive && streamMode !== "ai_stream" && (
          <DetectionCanvasOverlay camera={camera} isPlaying={isPlaying} />
        )}

        {/* 7. License Plate Reticles */}
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
            {displayDetections.map((det, idx) => {
              const style = getBoxStyle(det);
              let ymin = 0.2, xmin = 0.2, ymax = 0.6, xmax = 0.6;

              if (Array.isArray(det.normalized_box) && det.normalized_box.length === 4) {
                const [b0, b1, b2, b3] = det.normalized_box;
                ymin = Math.min(b0, b2);
                ymax = Math.max(b0, b2);
                xmin = Math.min(b1, b3);
                xmax = Math.max(b1, b3);
              }

              ymin = Math.max(0.005, Math.min(0.97, ymin));
              xmin = Math.max(0.005, Math.min(0.97, xmin));
              ymax = Math.max(ymin + 0.02, Math.min(0.995, ymax));
              xmax = Math.max(xmin + 0.02, Math.min(0.995, xmax));

              return (
                <div
                  key={`bbox-${idx}-${det.label || 'obj'}`}
                  className="ai-bbox-box"
                  style={{
                    top: `${(ymin * 100).toFixed(2)}%`,
                    left: `${(xmin * 100).toFixed(2)}%`,
                    width: `${((xmax - xmin) * 100).toFixed(2)}%`,
                    height: `${((ymax - ymin) * 100).toFixed(2)}%`,
                    border: `1.5px solid ${style.borderColor}`,
                    background: style.bg,
                    boxShadow: style.shadow,
                    position: "absolute",
                    willChange: "top, left, width, height"
                  }}
                >
                  <span className="ai-bbox-corner ai-bbox-tl" style={{ borderColor: style.borderColor }} />
                  <span className="ai-bbox-corner ai-bbox-tr" style={{ borderColor: style.borderColor }} />
                  <span className="ai-bbox-corner ai-bbox-bl" style={{ borderColor: style.borderColor }} />
                  <span className="ai-bbox-corner ai-bbox-br" style={{ borderColor: style.borderColor }} />
                  <div
                    className="ai-bbox-badge"
                    style={{
                      background: style.badgeBg,
                      color: style.textColor,
                      border: `1px solid ${style.borderColor}`
                    }}
                  >
                    <span>{det.plate ? String(det.plate) : (det.label || 'OBJECT')}</span>
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

      {/* Stream Protocol & Status Badge (Top-Left HUD - detailed view) */}
      {isDetailed && !streamError && !isLoading && (
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

      {/* Stream Switcher Toggle & Filter Controls */}
      {!streamError && allowAiStreamControls && (
        <div style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 25,
          display: "flex",
          alignItems: "center",
          background: "rgba(15, 23, 42, 0.92)",
          padding: "3px",
          borderRadius: "6px",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          gap: "3px"
        }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreferAiStream(false);
            }}
            title="Standard Raw CCTV Feed"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              background: !preferAiStream ? "rgba(59, 130, 246, 0.9)" : "transparent",
              border: !preferAiStream ? "1px solid #3b82f6" : "1px solid transparent",
              color: !preferAiStream ? "#fff" : "rgba(255, 255, 255, 0.65)",
              borderRadius: "4px",
              fontWeight: !preferAiStream ? 700 : 500,
              cursor: "pointer"
            }}
          >
            Raw Stream
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreferAiStream(true);
            }}
            title="Real-Time AI Stream"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              background: preferAiStream ? "rgba(16, 185, 129, 0.9)" : "transparent",
              border: preferAiStream ? "1px solid #10b981" : "1px solid transparent",
              color: preferAiStream ? "#fff" : "rgba(255, 255, 255, 0.65)",
              borderRadius: "4px",
              fontWeight: preferAiStream ? 700 : 500,
              cursor: "pointer"
            }}
          >
            AI Stream
          </button>
        </div>
      )}

      {/* 🚀 Sleek Centered Loading State ("Connecting to live feed...") */}
      {isLoading && !streamError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at center, rgba(15, 23, 42, 0.85) 0%, rgba(3, 7, 18, 0.95) 100%)",
            backdropFilter: "blur(4px)",
            padding: "16px",
            textAlign: "center"
          }}
        >
          {/* Radar Spinner */}
          <div style={{ position: "relative", width: "48px", height: "48px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid rgba(34, 211, 238, 0.25)",
                borderTopColor: "var(--accent)",
                animation: "radarSpin 1s linear infinite"
              }}
            />
            <Radio size={20} strokeWidth={2.4} style={{ color: "var(--accent)", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>

          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", letterSpacing: "0.3px", marginBottom: "3px" }}>
            Connecting to Live Feed...
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {camera.name || camera.camera_code || "Camera"}
          </div>
          <div style={{ fontSize: "9.5px", color: "rgba(34, 211, 238, 0.8)", marginTop: "6px", background: "rgba(34, 211, 238, 0.1)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
            Establishing {activeProtocol}
          </div>
        </div>
      )}

      {/* ⚠️ Sleek Centered "Connection Lost" + "Auto-reconnect" State (No Browser Error Page) */}
      {streamError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 25,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at center, rgba(30, 20, 25, 0.9) 0%, rgba(10, 8, 12, 0.98) 100%)",
            backdropFilter: "blur(6px)",
            padding: "16px",
            textAlign: "center"
          }}
        >
          {/* Pulsing WifiOff / Alert Icon */}
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "10px",
              boxShadow: "0 0 16px rgba(239, 68, 68, 0.2)"
            }}
          >
            <WifiOff size={22} strokeWidth={2.2} style={{ color: "#ef4444" }} />
          </div>

          <div style={{ fontSize: "13px", fontWeight: 800, color: "#fca5a5", letterSpacing: "0.4px" }}>
            Connection Lost
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {camera.name || camera.camera_code || "Camera"}
          </div>

          {/* Auto Reconnect Countdown Indicator */}
          <div
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              color: "#38bdf8",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              padding: "2px 8px",
              borderRadius: "12px",
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            <Activity size={10} style={{ animation: "pulse 1s infinite" }} />
            Auto-reconnecting in {retryCountdown}s...
          </div>

          {/* Manual Retry Action Button */}
          <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleManualRetry}
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                gap: "5px",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                borderColor: "#38bdf8",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <RefreshCw size={12} strokeWidth={2.4} /> Retry Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
