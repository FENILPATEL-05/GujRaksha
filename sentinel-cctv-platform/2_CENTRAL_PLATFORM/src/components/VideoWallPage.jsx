import React, { useState, useEffect, useRef } from "react";
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
  Sparkles,
  Lock,
  Building2,
  SlidersHorizontal,
  Check,
  X,
  Grid,
  GripVertical,
  RotateCcw,
  Crown,
  Target,
  Columns,
  Rows,
  Expand,
  Shrink
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LiveCCTVFeed } from "./LiveCCTVFeed";

// All Supported Professional NVR Layout Configurations
const NVR_LAYOUTS = [
  // 1. Asymmetric Center & Focus Master Layouts
  {
    id: "1+8-center",
    category: "master",
    name: "1+8 Center Master",
    badge: "9 CH · Center Focal",
    description: "1 Large Master in Center + 8 Surrounding Border Feeds",
    pageSize: 9,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="5.5" width="13" height="11" rx="2" fill="var(--accent)" opacity="0.9" />
        {/* Top 3 */}
        <rect x="2.5" y="2.5" width="6" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="11" y="2.5" width="6" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="19.5" y="2.5" width="6" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        {/* Left & Right */}
        <rect x="2.5" y="7" width="3.5" height="8" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="22" y="7" width="3.5" height="8" rx="0.5" fill="currentColor" opacity="0.4" />
        {/* Bottom 2 */}
        <rect x="2.5" y="17" width="10.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="15" y="17" width="10.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(4, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "2 / span 2", gridRow: "2 / span 2" }; // Center Big
      if (idx === 1) return { gridColumn: "1 / 2", gridRow: "1 / 2" };
      if (idx === 2) return { gridColumn: "2 / 3", gridRow: "1 / 2" };
      if (idx === 3) return { gridColumn: "3 / 4", gridRow: "1 / 2" };
      if (idx === 4) return { gridColumn: "4 / 5", gridRow: "1 / 2" };
      if (idx === 5) return { gridColumn: "1 / 2", gridRow: "2 / span 2" };
      if (idx === 6) return { gridColumn: "4 / 5", gridRow: "2 / span 2" };
      if (idx === 7) return { gridColumn: "1 / span 2", gridRow: "4 / 5" };
      if (idx === 8) return { gridColumn: "3 / span 2", gridRow: "4 / 5" };
      return {};
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "1+12-center",
    category: "master",
    name: "1+12 Center Command",
    badge: "13 CH · Center Matrix",
    description: "1 Large Master in Center + 12 Surrounding Border Feeds",
    pageSize: 13,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="8" y="5.5" width="12" height="11" rx="2" fill="var(--accent)" opacity="0.9" />
        {/* Top 4 */}
        <rect x="2.5" y="2.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="8.5" y="2.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14.5" y="2.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="20.5" y="2.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        {/* Left 2 & Right 2 */}
        <rect x="2.5" y="6" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="2.5" y="11.5" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21.5" y="6" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21.5" y="11.5" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.4" />
        {/* Bottom 4 */}
        <rect x="2.5" y="17.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="8.5" y="17.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14.5" y="17.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="20.5" y="17.5" width="4.5" height="2" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(4, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "2 / span 2", gridRow: "2 / span 2" };
      if (idx === 1) return { gridColumn: "1 / 2", gridRow: "1 / 2" };
      if (idx === 2) return { gridColumn: "2 / 3", gridRow: "1 / 2" };
      if (idx === 3) return { gridColumn: "3 / 4", gridRow: "1 / 2" };
      if (idx === 4) return { gridColumn: "4 / 5", gridRow: "1 / 2" };
      if (idx === 5) return { gridColumn: "1 / 2", gridRow: "2 / 3" };
      if (idx === 6) return { gridColumn: "4 / 5", gridRow: "2 / 3" };
      if (idx === 7) return { gridColumn: "1 / 2", gridRow: "3 / 4" };
      if (idx === 8) return { gridColumn: "4 / 5", gridRow: "3 / 4" };
      if (idx === 9) return { gridColumn: "1 / 2", gridRow: "4 / 5" };
      if (idx === 10) return { gridColumn: "2 / 3", gridRow: "4 / 5" };
      if (idx === 11) return { gridColumn: "3 / 4", gridRow: "4 / 5" };
      if (idx === 12) return { gridColumn: "4 / 5", gridRow: "4 / 5" };
      return {};
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "1+3",
    category: "master",
    name: "1+3 Left Focus",
    badge: "4 CH · Left Master",
    description: "1 Large Master on Left + 3 Stacked Feeds on Right",
    pageSize: 4,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="16" height="17" rx="2" fill="var(--accent)" opacity="0.9" />
        <rect x="20" y="2.5" width="5.5" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="20" y="8.5" width="5.5" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="20" y="14.5" width="5.5" height="5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "3fr 1.15fr",
      gridTemplateRows: "repeat(3, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / 2", gridRow: "1 / span 3" };
      return { gridColumn: "2 / 3", gridRow: `${idx} / ${idx + 1}` };
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "1+3-top",
    category: "master",
    name: "1+3 Top Master",
    badge: "4 CH · Top Master",
    description: "1 Panoramic Master on Top + 3 Bottom Feeds",
    pageSize: 4,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="23" height="11" rx="2" fill="var(--accent)" opacity="0.9" />
        <rect x="2.5" y="15" width="6.8" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="10.5" y="15" width="6.8" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="18.5" y="15" width="7" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "3fr 1.15fr"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / span 3", gridRow: "1 / 2" };
      return { gridColumn: `${idx} / ${idx + 1}`, gridRow: "2 / 3" };
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "1+5",
    category: "master",
    name: "1+5 Corner Master",
    badge: "6 CH · Top-Left Focus",
    description: "1 Large Master (2×2) + 5 Surrounding Feeds",
    pageSize: 6,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="15" height="12" rx="2" fill="var(--accent)" opacity="0.9" />
        <rect x="19" y="2.5" width="6.5" height="5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="19" y="9" width="6.5" height="5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="2.5" y="16" width="6.8" height="3.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="10.5" y="16" width="6.8" height="3.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="18.5" y="16" width="7" height="3.5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / span 2", gridRow: "1 / span 2" };
      if (idx === 1) return { gridColumn: "3 / 4", gridRow: "1 / 2" };
      if (idx === 2) return { gridColumn: "3 / 4", gridRow: "2 / 3" };
      if (idx === 3) return { gridColumn: "1 / 2", gridRow: "3 / 4" };
      if (idx === 4) return { gridColumn: "2 / 3", gridRow: "3 / 4" };
      if (idx === 5) return { gridColumn: "3 / 4", gridRow: "3 / 4" };
      return {};
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "1+7",
    category: "master",
    name: "1+7 Perimeter Command",
    badge: "8 CH · 3×3 Master",
    description: "1 Large Master (3×3) + 7 Surrounding Border Feeds",
    pageSize: 8,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="17" height="13" rx="2" fill="var(--accent)" opacity="0.9" />
        <rect x="21" y="2.5" width="4.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21" y="7" width="4.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21" y="11.5" width="4.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="2.5" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="8.5" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14.5" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(4, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / span 3", gridRow: "1 / span 3" };
      if (idx === 1) return { gridColumn: "4 / 5", gridRow: "1 / 2" };
      if (idx === 2) return { gridColumn: "4 / 5", gridRow: "2 / 3" };
      if (idx === 3) return { gridColumn: "4 / 5", gridRow: "3 / 4" };
      if (idx === 4) return { gridColumn: "1 / 2", gridRow: "4 / 5" };
      if (idx === 5) return { gridColumn: "2 / 3", gridRow: "4 / 5" };
      if (idx === 6) return { gridColumn: "3 / 4", gridRow: "4 / 5" };
      if (idx === 7) return { gridColumn: "4 / 5", gridRow: "4 / 5" };
      return {};
    },
    isMasterSlot: (idx) => idx === 0
  },
  {
    id: "2+8",
    category: "master",
    name: "2+8 Dual Master",
    badge: "10 CH · Dual Top",
    description: "2 Large Masters on Top + 8 Feeds on Bottom",
    pageSize: 10,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="10.5" height="9.5" rx="1.5" fill="var(--accent)" opacity="0.9" />
        <rect x="15" y="2.5" width="10.5" height="9.5" rx="1.5" fill="var(--accent)" opacity="0.9" />
        <rect x="2.5" y="13.5" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="8.5" y="13.5" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="15" y="13.5" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21" y="13.5" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="2.5" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="8.5" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="15" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="21" y="17" width="4.5" height="2.5" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(4, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / span 2", gridRow: "1 / span 2" };
      if (idx === 1) return { gridColumn: "3 / span 2", gridRow: "1 / span 2" };
      if (idx === 2) return { gridColumn: "1 / 2", gridRow: "3 / 4" };
      if (idx === 3) return { gridColumn: "2 / 3", gridRow: "3 / 4" };
      if (idx === 4) return { gridColumn: "3 / 4", gridRow: "3 / 4" };
      if (idx === 5) return { gridColumn: "4 / 5", gridRow: "3 / 4" };
      if (idx === 6) return { gridColumn: "1 / 2", gridRow: "4 / 5" };
      if (idx === 7) return { gridColumn: "2 / 3", gridRow: "4 / 5" };
      if (idx === 8) return { gridColumn: "3 / 4", gridRow: "4 / 5" };
      if (idx === 9) return { gridColumn: "4 / 5", gridRow: "4 / 5" };
      return {};
    },
    isMasterSlot: (idx) => idx === 0 || idx === 1
  },
  {
    id: "1+4-corridor",
    category: "master",
    name: "1+4 Corridor Focus",
    badge: "5 CH · Vertical Tall",
    description: "1 Tall Corridor Feed on Left + 4 Stacked Feeds on Right",
    pageSize: 5,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="9.5" height="17" rx="2" fill="var(--accent)" opacity="0.9" />
        <rect x="14" y="2.5" width="11.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14" y="7" width="11.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14" y="11.5" width="11.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
        <rect x="14" y="16" width="11.5" height="3.5" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "1.1fr 2fr",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: (idx) => {
      if (idx === 0) return { gridColumn: "1 / 2", gridRow: "1 / span 4" };
      return { gridColumn: "2 / 3", gridRow: `${idx} / ${idx + 1}` };
    },
    isMasterSlot: (idx) => idx === 0
  },

  // 2. Standard Symmetric NVR Matrices
  {
    id: "1x1",
    category: "matrix",
    name: "1×1 Single Focus",
    badge: "1 Channel",
    description: "Single Camera Full Screen HD View",
    pageSize: 1,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="3" y="3" width="22" height="16" rx="2" fill="var(--accent)" opacity="0.8" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "1fr"
    },
    getTileStyle: () => ({}),
    isMasterSlot: () => false
  },
  {
    id: "2x2",
    category: "matrix",
    name: "2×2 Quad Matrix",
    badge: "4 Channels",
    description: "Standard 4-Channel Quad Surveillance View",
    pageSize: 4,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="10.5" height="7.5" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="15" y="2.5" width="10.5" height="7.5" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="2.5" y="12" width="10.5" height="7.5" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="15" y="12" width="10.5" height="7.5" rx="1" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(2, 1fr)",
      gridTemplateRows: "repeat(2, 1fr)"
    },
    getTileStyle: () => ({}),
    isMasterSlot: () => false
  },
  {
    id: "3x3",
    category: "matrix",
    name: "3×3 NVR Matrix",
    badge: "9 Channels",
    description: "9-Camera Surveillance Matrix",
    pageSize: 9,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.5" y="2.5" width="6.8" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="10.5" y="2.5" width="6.8" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="18.5" y="2.5" width="7" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="2.5" y="8.5" width="6.8" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="10.5" y="8.5" width="6.8" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="18.5" y="8.5" width="7" height="4.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="2.5" y="14.5" width="6.8" height="5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="10.5" y="14.5" width="6.8" height="5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="18.5" y="14.5" width="7" height="5" rx="0.5" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)"
    },
    getTileStyle: () => ({}),
    isMasterSlot: () => false
  },
  {
    id: "4x4",
    category: "matrix",
    name: "4×4 High Density",
    badge: "16 Channels",
    description: "16-Channel Enterprise Video Wall Matrix",
    pageSize: 16,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <line x1="7.5" y1="1" x2="7.5" y2="21" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        <line x1="14" y1="1" x2="14" y2="21" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        <line x1="20.5" y1="1" x2="20.5" y2="21" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        <line x1="1" y1="6" x2="27" y2="6" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        <line x1="1" y1="11" x2="27" y2="11" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
        <line x1="1" y1="16" x2="27" y2="16" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(4, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)"
    },
    getTileStyle: () => ({}),
    isMasterSlot: () => false
  },
  {
    id: "5x5",
    category: "matrix",
    name: "5×5 Enterprise Matrix",
    badge: "25 Channels",
    description: "25-Channel Command Center Overview",
    pageSize: 25,
    icon: (
      <svg width="34" height="26" viewBox="0 0 28 22" fill="none">
        <rect x="1" y="1" width="26" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="6" cy="6" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="6" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="22" cy="6" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="6" cy="11" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="11" r="1.5" fill="var(--accent)" />
        <circle cx="22" cy="11" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="6" cy="16" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="16" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="22" cy="16" r="1.5" fill="currentColor" opacity="0.6" />
      </svg>
    ),
    containerStyle: {
      gridTemplateColumns: "repeat(5, 1fr)",
      gridTemplateRows: "repeat(5, 1fr)"
    },
    getTileStyle: () => ({}),
    isMasterSlot: () => false
  }
];

export const VideoWallPage = ({
  cameras = [],
  departments = [],
  onCameraSelect
}) => {
  const { isDeptAdmin, userDepartmentId, userDepartmentName } = useAuth();

  // Active Grid Layout Mode ID (defaults to "1+8-center" Center Master or saved mode)
  const [gridMode, setGridMode] = useState(() => localStorage.getItem("gujraksha_videowall_grid") || "1+8-center");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedModalLayoutId, setSelectedModalLayoutId] = useState(gridMode);
  const [customTab, setCustomTab] = useState("all"); // "all", "master", "matrix"

  // In-Place Fullscreen Camera Stage (Double-click zoom without altering page, grid, or order)
  const [fullscreenCam, setFullscreenCam] = useState(null);
  const [fullscreenHovered, setFullscreenHovered] = useState(false);

  const [selectedDept, setSelectedDept] = useState(() => (isDeptAdmin && userDepartmentId !== "ALL") ? userDepartmentId : "ALL");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Drag & Drop Positioning State
  const [customOrderedCameras, setCustomOrderedCameras] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    if (isDeptAdmin && userDepartmentId !== "ALL") {
      setSelectedDept(userDepartmentId);
    }
  }, [isDeptAdmin, userDepartmentId]);

  useEffect(() => {
    localStorage.setItem("gujraksha_videowall_grid", gridMode);
  }, [gridMode]);

  // ESC key listener to exit in-place fullscreen stage
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && fullscreenCam) {
        setFullscreenCam(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenCam]);

  // Base filter cameras by Department and District
  const filteredCameras = cameras.filter(c => {
    const matchDept = selectedDept === "ALL" || (c.department_id || "").toUpperCase() === selectedDept.toUpperCase();
    const matchDistrict = selectedDistrict === "ALL" || (c.district || "").toLowerCase() === selectedDistrict.toLowerCase();
    return matchDept && matchDistrict;
  });

  // Sync custom ordered list when base list changes
  useEffect(() => {
    setCustomOrderedCameras(filteredCameras);
  }, [cameras, selectedDept, selectedDistrict]);

  // Find active layout config
  const currentLayout = NVR_LAYOUTS.find(l => l.id === gridMode) || NVR_LAYOUTS[0];
  const pageSize = currentLayout.pageSize;
  const currentPool = customOrderedCameras.length > 0 ? customOrderedCameras : filteredCameras;
  
  // Calculate active cameras for current page without altering custom order
  const totalPages = Math.ceil(currentPool.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const activeCameras = currentPool.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [gridMode, selectedDept, selectedDistrict]);

  // Handle Double-Click to Seamlessly Expand Camera Full-Screen (Stage overlay without resetting page or grid)
  const handleDoubleClickTile = (cam) => {
    if (fullscreenCam) {
      setFullscreenCam(null);
    } else {
      setFullscreenCam(cam);
    }
  };

  // Handle Drag and Drop Position Swapping
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const actualSourceIdx = startIndex + draggedIndex;
    const actualTargetIdx = startIndex + targetIndex;

    const updated = [...currentPool];
    const [moved] = updated.splice(actualSourceIdx, 1);
    updated.splice(actualTargetIdx, 0, moved);

    setCustomOrderedCameras(updated);
    setDraggedIndex(null);
  };

  const handleSelectLayout = (layoutId) => {
    setGridMode(layoutId);
  };

  const handleOpenCustomModal = () => {
    setSelectedModalLayoutId(gridMode);
    setShowCustomModal(true);
  };

  const handleSaveAndApplyModal = () => {
    handleSelectLayout(selectedModalLayoutId);
    setShowCustomModal(false);
  };

  const handleResetOrder = () => {
    setCustomOrderedCameras(filteredCameras);
  };

  const isHighDensity = (currentLayout.pageSize >= 16);

  // Filtered layouts for Custom Modal
  const modalLayouts = NVR_LAYOUTS.filter(l => {
    if (customTab === "master") return l.category === "master";
    if (customTab === "matrix") return l.category === "matrix";
    return true;
  });

  const chosenModalLayout = NVR_LAYOUTS.find(l => l.id === selectedModalLayoutId) || currentLayout;

  return (
    <div 
      className="table-view" 
      style={{ 
        position: "relative",
        display: "flex", 
        flexDirection: "column", 
        height: "calc(100vh - 64px)", 
        padding: "10px 14px", 
        overflow: "hidden"
      }}
    >
      {/* 1. Main Video Wall Controls Toolbar (Fixed / Clean Top Bar) */}
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "8px", 
          flexWrap: "wrap", 
          gap: "10px",
          padding: "4px 2px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <LayoutGrid size={19} strokeWidth={2.4} style={{ color: "var(--accent)" }} />
            Video Wall
          </h2>
          {isDeptAdmin && (
            <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)', fontSize: '11px', gap: '4px' }}>
              <Building2 size={11} strokeWidth={2.5} /> {userDepartmentName || userDepartmentId}
            </span>
          )}
          <span style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", background: "rgba(34, 211, 238, 0.12)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(34, 211, 238, 0.3)", fontWeight: 700 }}>
            {currentLayout.name} ({currentLayout.badge})
          </span>
        </div>

        {/* Right Toolbar Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Department Filter */}
          {isDeptAdmin && userDepartmentId !== "ALL" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", background: "var(--input-bg)", borderRadius: "8px", border: "1px solid var(--panel-border)", fontSize: "11.5px", color: "var(--accent)" }}>
              <Lock size={11} />
              <span style={{ fontWeight: 600 }}>{userDepartmentName || userDepartmentId}</span>
            </div>
          ) : (
            <select
              className="filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ fontSize: "11.5px", padding: "5px 8px" }}
            >
              <option value="ALL">All Departments ({departments.length || "26+"})</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          )}

          {/* District Filter */}
          <select
            className="filter-select"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{ fontSize: "11.5px", padding: "5px 8px" }}
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

          {/* Direct Switcher Quick Pills: ONLY 2x2 and 3x3 + Custom Layouts Selector */}
          <div className="view-switcher" style={{ background: "var(--input-bg)", padding: "2px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "2px" }}>
            <button
              className={gridMode === "2x2" ? "active" : ""}
              onClick={() => handleSelectLayout("2x2")}
              title="2×2 Quad Matrix (4 Channels)"
              style={{ fontSize: "11px", padding: "4px 10px", fontWeight: gridMode === "2x2" ? 700 : 500 }}
            >
              2×2
            </button>
            <button
              className={gridMode === "3x3" ? "active" : ""}
              onClick={() => handleSelectLayout("3x3")}
              title="3×3 Matrix (9 Channels)"
              style={{ fontSize: "11px", padding: "4px 10px", fontWeight: gridMode === "3x3" ? 700 : 500 }}
            >
              3×3
            </button>

            {/* Custom Layouts Centered Modal Trigger (Hosts all Master, Split & Density Layouts) */}
            <button
              className={!["2x2", "3x3"].includes(gridMode) ? "active" : ""}
              onClick={handleOpenCustomModal}
              title="Open Centered NVR Split Layouts Selection Dialog"
              style={{ fontSize: "11px", padding: "4px 10px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}
            >
              <SlidersHorizontal size={11} strokeWidth={2.4} />
              <span>Custom Layouts ({NVR_LAYOUTS.length})</span>
            </button>
          </div>

          {/* Reset Order Button if cameras were reordered */}
          {customOrderedCameras.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={handleResetOrder}
              title="Reset Drag-and-Drop camera positions"
              style={{ fontSize: "11px", padding: "3px 8px", gap: "3px" }}
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                className="btn btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ padding: "3px 6px" }}
              >
                <ChevronLeft size={12} />
              </button>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {currentPage}/{totalPages}
              </span>
              <button
                className="btn btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: "3px 6px" }}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Video Wall Dynamic Matrix Container (Edge-to-Edge Clean Full Video Height) */}
      <div
        style={{
          flex: 1,
          display: "grid",
          ...currentLayout.containerStyle,
          gap: isHighDensity ? "4px" : "8px",
          minHeight: 0,
          height: "100%",
          width: "100%",
          background: "var(--bg)",
          borderRadius: "10px",
          border: "1px solid var(--panel-border)",
          padding: isHighDensity ? "4px" : "6px"
        }}
      >
        {activeCameras.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
            <Video size={48} strokeWidth={1.4} style={{ color: "var(--accent)", marginBottom: "12px" }} />
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>No cameras available in this filter layout.</div>
          </div>
        ) : (
          activeCameras.map((cam, idx) => {
            const tileStyle = currentLayout.getTileStyle ? currentLayout.getTileStyle(idx) : {};
            const isMaster = currentLayout.isMasterSlot ? currentLayout.isMasterSlot(idx) : false;
            const isBeingDragged = draggedIndex === idx;
            const isDraggedOver = dragOverIndex === idx;
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={cam.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, idx)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDoubleClickTile(cam);
                }}
                style={{
                  ...tileStyle,
                  background: "#000",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: isDraggedOver
                    ? "2px dashed var(--accent)"
                    : isMaster
                    ? "2px solid rgba(34, 211, 238, 0.6)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: isMaster
                    ? "0 8px 24px rgba(34, 211, 238, 0.18)"
                    : "0 4px 14px rgba(0,0,0,0.4)",
                  opacity: isBeingDragged ? 0.6 : 1,
                  transform: isDraggedOver ? "scale(0.98)" : "scale(1)",
                  transition: "border 0.15s ease, transform 0.15s ease, opacity 0.15s ease",
                  position: "relative",
                  cursor: isBeingDragged ? "grabbing" : "grab",
                  userSelect: "none",
                  WebkitUserSelect: "none"
                }}
                title="Double-click for Full-Screen · Drag anywhere on camera to swap positions"
              >
                {/* 1. 100% Pure Full-Height Video Stream */}
                <div 
                  style={{ 
                    position: "absolute", 
                    inset: 0, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    background: "#000",
                    pointerEvents: "none",
                    userSelect: "none"
                  }}
                >
                  <LiveCCTVFeed camera={cam} isMuted={isMuted} showAiVision={false} />
                </div>

                {/* 2. Unified Bottom Glassmorphism Bar (ONLY VISIBLE ON HOVER) */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    padding: isHighDensity ? "4px 8px" : "6px 12px",
                    background: "linear-gradient(0deg, rgba(6, 11, 19, 0.95) 0%, rgba(6, 11, 19, 0.7) 70%, transparent 100%)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    pointerEvents: isHovered ? "auto" : "none",
                    userSelect: "none"
                  }}
                >
                  {/* Left Info: Live Status + Master Badge + Name + Code + District */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", flex: 1 }}>
                    <span className="dot active" style={{ width: "5px", height: "5px", flexShrink: 0 }}></span>
                    
                    {isMaster && (
                      <span className="badge" style={{ background: "rgba(34, 211, 238, 0.3)", color: "#22d3ee", padding: "1px 5px", fontSize: "9px", gap: "3px", fontWeight: 800, flexShrink: 0 }}>
                        {gridMode.includes("center") ? <Target size={9} strokeWidth={2.5} /> : <Crown size={9} strokeWidth={2.5} />}
                        {gridMode.includes("center") ? "CENTER" : "MASTER"}
                      </span>
                    )}

                    <span style={{ fontSize: isHighDensity ? "10px" : "11.5px", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                      {cam.name}
                    </span>

                    <span style={{ fontSize: "9.5px", fontFamily: "var(--font-mono)", color: "var(--accent)", flexShrink: 0, textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>
                      ({cam.camera_code || cam.id})
                    </span>

                    <span style={{ fontSize: "8.5px", background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", padding: "1px 5px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
                      {cam.district || "Gujarat"}
                    </span>
                  </div>

                  {/* Right Actions: Full View & Inspect Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClickTile(cam);
                      }}
                      title="Expand to Full-Screen View"
                      style={{ padding: "2px 7px", fontSize: "9.5px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", gap: "3px" }}
                    >
                      <Expand size={10} /> Full View
                    </button>

                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCameraSelect(cam);
                      }}
                      title="Inspect in Single HD Player with PTZ"
                      style={{ padding: "2px 8px", fontSize: "9.5px", gap: "3px" }}
                    >
                      <Maximize2 size={10} /> Inspect
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. In-Place Seamless Full-Screen Stage (Expands over Video Wall on double click, ESC/Double-click exits back to exact page & positions) */}
      {fullscreenCam && (
        <div
          onMouseEnter={() => setFullscreenHovered(true)}
          onMouseLeave={() => setFullscreenHovered(false)}
          onDoubleClick={() => setFullscreenCam(null)}
          onMouseDown={(e) => {
            if (e.detail > 1) e.preventDefault();
          }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            userSelect: "none"
          }}
        >
          {/* 100% Pure Full-Height HD Feed */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", pointerEvents: "none" }}>
            <LiveCCTVFeed camera={fullscreenCam} isMuted={isMuted} showAiVision={false} />
          </div>

          {/* Top Floating Glassmorphism Bar on Hover */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 110,
              padding: "10px 16px",
              background: "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 70%, transparent 100%)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: fullscreenHovered ? 1 : 0.4,
              transform: fullscreenHovered ? "translateY(0)" : "translateY(-4px)",
              transition: "all 0.2s ease",
              pointerEvents: "auto"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="dot active" style={{ width: "8px", height: "8px" }}></span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}>
                {fullscreenCam.name}
              </span>
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent)", background: "rgba(34, 211, 238, 0.15)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(34, 211, 238, 0.3)" }}>
                {fullscreenCam.camera_code || fullscreenCam.id}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)" }}>
                {fullscreenCam.district || "Gujarat"} · {fullscreenCam.department_id || "POLICE"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onCameraSelect(fullscreenCam);
                }}
                style={{ fontSize: "11px", padding: "4px 12px", gap: "4px" }}
              >
                <Maximize2 size={12} /> Full PTZ Inspector
              </button>

              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenCam(null);
                }}
                style={{ fontSize: "11px", padding: "4px 12px", background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", gap: "4px" }}
              >
                <Minimize2 size={12} /> Exit Full View (ESC / Double-Click)
              </button>
            </div>
          </div>

          {/* Bottom Floating Hint */}
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 110,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.8)",
              opacity: fullscreenHovered ? 1 : 0,
              transition: "opacity 0.2s ease",
              pointerEvents: "none"
            }}
          >
            💡 Double-click or press ESC to return to Grid View (Page {currentPage})
          </div>
        </div>
      )}

      {/* 4. Center Modal Dialog: Professional NVR Split Layouts Selection & Save */}
      {showCustomModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowCustomModal(false)}>
          <div 
            className="modal modal-md" 
            style={{ 
              maxWidth: "840px", 
              maxHeight: "88vh", 
              background: "var(--panel-bg-solid)", 
              borderRadius: "18px", 
              border: "1px solid var(--panel-border-strong)", 
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)" 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-head" style={{ padding: "16px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(34, 211, 238, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                  <Grid size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    Select Video Wall Layout
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "var(--text-dim)", fontWeight: 400 }}>
                    Choose your preferred NVR split-screen matrix or master focal perspective.
                  </span>
                </div>
              </div>
              <button 
                className="modal-close" 
                onClick={() => setShowCustomModal(false)}
                title="Close Layout Selection"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
              {/* Category Filter Pills */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[
                  { id: "all", label: `All Layouts (${NVR_LAYOUTS.length})` },
                  { id: "master", label: `⭐ Master / Center Focus (${NVR_LAYOUTS.filter(l => l.category === "master").length})` },
                  { id: "matrix", label: `🔲 Equal Surveillance Grids (${NVR_LAYOUTS.filter(l => l.category === "matrix").length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setCustomTab(tab.id)}
                    style={{
                      fontSize: "11px",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: customTab === tab.id ? "rgba(34, 211, 238, 0.18)" : "var(--input-bg)",
                      borderColor: customTab === tab.id ? "var(--accent)" : "var(--panel-border)",
                      color: customTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                      fontWeight: customTab === tab.id ? 700 : 500
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Layout Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "12px" }}>
                {modalLayouts.map(layout => {
                  const isSelected = selectedModalLayoutId === layout.id;
                  return (
                    <div
                      key={layout.id}
                      onClick={() => setSelectedModalLayoutId(layout.id)}
                      onDoubleClick={() => {
                        setSelectedModalLayoutId(layout.id);
                        handleSelectLayout(layout.id);
                        setShowCustomModal(false);
                      }}
                      style={{
                        padding: "14px",
                        borderRadius: "12px",
                        background: isSelected ? "rgba(34, 211, 238, 0.14)" : "var(--input-bg)",
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        transition: "all 0.18s ease",
                        transform: isSelected ? "translateY(-2px)" : "none",
                        boxShadow: isSelected ? "0 8px 24px rgba(34, 211, 238, 0.25)" : "0 2px 8px rgba(0,0,0,0.2)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ color: isSelected ? "var(--accent)" : "var(--text-secondary)" }}>
                            {layout.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 800, color: isSelected ? "var(--accent)" : "var(--text-primary)" }}>
                              {layout.name}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: "1px" }}>
                              {layout.badge}
                            </div>
                          </div>
                        </div>

                        <div 
                          style={{ 
                            width: "20px", 
                            height: "20px", 
                            borderRadius: "50%", 
                            border: isSelected ? "2px solid var(--accent)" : "2px solid var(--panel-border)", 
                            background: isSelected ? "var(--accent)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#000",
                            flexShrink: 0
                          }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                        {layout.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-foot" style={{ padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", background: "var(--panel-bg-solid)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Selected Layout:</span>
                <span style={{ fontWeight: 800, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                  {chosenModalLayout.name} ({chosenModalLayout.badge})
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveAndApplyModal}
                  style={{ gap: "6px", fontWeight: 700, padding: "7px 18px" }}
                >
                  <Check size={15} strokeWidth={2.4} /> Apply & Save Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
