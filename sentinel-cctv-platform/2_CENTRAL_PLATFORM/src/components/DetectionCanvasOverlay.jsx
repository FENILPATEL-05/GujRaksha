import React, { useEffect, useRef, useState } from "react";
import aiVisionSocket from "../services/aiVisionSocket.js";

export const DetectionCanvasOverlay = ({ camera, isPlaying = true }) => {
  const canvasRef = useRef(null);
  const [bboxes, setBboxes] = useState([]);

  const getCleanCode = (cam) => {
    if (!cam) return "GJ-GOV-001";
    return cam.camera_code || cam.id || "GJ-GOV-001";
  };

  const cameraCode = getCleanCode(camera);

  // Subscribe to real-time bounding box telemetry stream via WebSocket singleton
  useEffect(() => {
    if (!cameraCode || !isPlaying) return;

    setBboxes([]);
    let isSubscribed = true;
    let staleTimer = null;

    const handleVisionFrame = (detections) => {
      if (!isSubscribed) return;
      setBboxes(detections || []);

      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (isSubscribed) setBboxes([]);
      }, 400);
    };

    aiVisionSocket.subscribe(cameraCode, handleVisionFrame);

    return () => {
      isSubscribed = false;
      if (staleTimer) clearTimeout(staleTimer);
      aiVisionSocket.unsubscribe(cameraCode, handleVisionFrame);
    };
  }, [cameraCode, isPlaying, camera?.id]);

  // Render bounding boxes onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!parent) return;

    // Resize canvas to fit container
    const width = parent.clientWidth || 640;
    const height = parent.clientHeight || 360;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!bboxes || bboxes.length === 0) return;

    bboxes.forEach((box) => {
      let ymin = 0, xmin = 0, ymax = 0, xmax = 0;
      if (Array.isArray(box.normalized_box) && box.normalized_box.length === 4) {
        const [b0, b1, b2, b3] = box.normalized_box;
        ymin = Math.min(b0, b2);
        ymax = Math.max(b0, b2);
        xmin = Math.min(b1, b3);
        xmax = Math.max(b1, b3);
      } else if (Array.isArray(box.norm_box) && box.norm_box.length === 4) {
        const [b0, b1, b2, b3] = box.norm_box;
        ymin = Math.min(b0, b2);
        ymax = Math.max(b0, b2);
        xmin = Math.min(b1, b3);
        xmax = Math.max(b1, b3);
      } else if (Array.isArray(box.box) && box.box.length === 4) {
        const frameW = box.frame_width || box.frame_w || 1920;
        const frameH = box.frame_height || box.frame_h || 1080;
        const [c0, c1, c2, c3] = box.box;
        if (c0 <= 1.05 && c1 <= 1.05 && c2 <= 1.05 && c3 <= 1.05) {
          xmin = Math.min(c0, c2); xmax = Math.max(c0, c2);
          ymin = Math.min(c1, c3); ymax = Math.max(c1, c3);
        } else {
          let x1 = c0, y1 = c1, x2 = c2, y2 = c3;
          if (x2 < x1) x2 = x1 + c2;
          if (y2 < y1) y2 = y1 + c3;
          xmin = Math.min(x1, x2) / frameW;
          xmax = Math.max(x1, x2) / frameW;
          ymin = Math.min(y1, y2) / frameH;
          ymax = Math.max(y1, y2) / frameH;
        }
      }

      const x = xmin * width;
      const y = ymin * height;
      const w = Math.max(10, (xmax - xmin) * width);
      const h = Math.max(10, (ymax - ymin) * height);
      const cx = x + w / 2;
      const cy = y + h / 2;

      const cls = String(box.class_name || box.class || box.label || box.type || "object").toLowerCase();
      const isPlate = cls.includes("plate") || cls.includes("anpr");
      const isPerson = cls.includes("person") || cls.includes("pedestrian");
      const isCar = cls.includes("car");
      const isMotorcycle = cls.includes("motorcycle") || cls.includes("bike");
      const isBus = cls.includes("bus");
      const isTruck = cls.includes("truck");

      // Strictly allow ONLY the 5 target classes + license plate
      if (!isPerson && !isCar && !isMotorcycle && !isBus && !isTruck && !isPlate) {
        return;
      }

      const isHit = box.is_watchlist || box.is_loitering || box.is_intrusion;

      let color = "#22c55e"; // Default Green for Vehicles
      if (isHit) color = "#ef4444"; // Red for Watchlist / Loitering / Intrusion
      else if (isPlate) color = "#eab308"; // Yellow for Plates
      else if (isPerson) color = "#3b82f6"; // Blue for Persons
      else if (isMotorcycle) color = "#a855f7"; // Purple for 2-Wheelers


      // 1. Render Motion Trajectory Trails (Neon Yellow/Cyan glowing path)
      if (box.trail_points && box.trail_points.length > 1) {
        ctx.save();
        ctx.strokeStyle = isHit ? "#f87171" : "#00f0ff";
        ctx.lineWidth = 2.0;
        ctx.shadowColor = isHit ? "#ef4444" : "#00f0ff";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        box.trail_points.forEach(([ptX, ptY], idx) => {
          const px = ptX * width;
          const py = ptY * height;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        
        // Centroid pulse dot
        ctx.fillStyle = isHit ? "#ef4444" : "#00f0ff";
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }

      // 2. Draw Bounding Box with Tech Shadow
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHit ? 10 : 6;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0; // Reset shadow

      // Draw corner brackets for high-tech HUD effect
      const cornerLen = Math.min(12, Math.min(w, h) / 4);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      // Top-Right
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
      // Bottom-Left
      ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h);
      // Bottom-Right
      ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // Label text preparation
      let labelText = box.label || `${box.class || 'Object'} ${box.confidence ? Math.round(box.confidence * 100) + '%' : ''}`;
      if (box.track_id && !labelText.includes("#")) {
        labelText = `${labelText} #${box.track_id}`;
      }
      ctx.font = "bold 11px system-ui, sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const bgW = textMetrics.width + 12;
      const bgH = 18;
      const badgeY = Math.max(0, y - bgH);

      // Label background badge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, badgeY, bgW, bgH, 4) : ctx.rect(x, badgeY, bgW, bgH);
      ctx.fill();

      // Label text
      ctx.fillStyle = isHit ? "#ffffff" : "#000000";
      ctx.fillText(labelText, x + 6, badgeY + 13);

      // If plate OCR string is present
      if (box.plate_text || box.plate) {
        const pText = box.plate_text || box.plate;
        const plateText = `🚘 ${pText}`;
        const plateMetrics = ctx.measureText(plateText);
        const pBgW = plateMetrics.width + 12;
        const pY = y + h + 2;

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, pY, pBgW, bgH, 4) : ctx.rect(x, pY, pBgW, bgH);
        ctx.fill();
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, pY, pBgW, bgH);

        ctx.fillStyle = "#facc15";
        ctx.fillText(plateText, x + 6, pY + 13);
      }
    });
  }, [bboxes]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10
      }}
    />
  );
};
