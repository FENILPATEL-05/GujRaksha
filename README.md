# 🛡️ GujRaksha (ગુજ રક્ષા)
### Statewide Industrial CCTV Asset Registry & Spatial GIS Control Platform

**GujRaksha** is an industrial-grade, multi-tenant CCTV asset registry, GIS mapping, and spatial analytics system designed for **Gujarat Police & RTO**. It unifies camera streams, feeds, and analytics across all districts of Gujarat into a high-performance control room dashboard.

---

## ✨ Features

- **🌐 Interactive GIS Map View**: Real-time Leaflet GIS mapping with district boundaries, live stream preview tooltips, and cluster indicators across Gujarat.
- **📋 Master Camera Registry**: Advanced tabular view with live search, filters (district, status, agency, VMS vendor), pagination, and instant CSV/JSON exports.
- **📡 Live Stream Feeds**: Integration with government video feeds, RTSP/HLS proxy streaming, and video modal overlay.
- **⚡ Unified Server Architecture**: Express.js REST API + Vite middleware running on a single port for optimized local development and seamless production deployment.
- **🎨 Modern Dark/Light Design**: Clean UI with custom styling, smooth micro-animations, accessible color contrast, and Gujarat Police branding.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/FENILPATEL-05/GujRaksha.git
   cd GujRaksha/sentinel-cctv-platform
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Access Platform**:
   Open your browser and navigate to `http://localhost:3000`.

---

## 🛠️ Project Structure

```
GujRaksha/
├── README.md
├── .gitignore
├── sentinel-cctv-platform/
│   ├── index.html
│   ├── package.json
│   ├── server.js
│   ├── vite.config.js
│   └── src/
│       ├── components/     # React Components (Header, MapView, CameraRegistry, etc.)
│       ├── config/         # Environment configurations
│       ├── routes/         # Express API Routes
│       └── services/       # API Services & Stream Feeders
```

---

## 🔒 Copyright & Intellectual Property

**Copyright (c) 2026 Fenil Patel (GujRaksha). All Rights Reserved.**

- **Owner**: Fenil Patel
- **Project**: GujRaksha (ગુજ રક્ષા) Statewide CCTV Platform
- **License**: Custom License v1.0 (Strictly Proprietary & Confidential)

### Legal Notice & License Terms
All rights reserved. The source code, software architecture, user interfaces, documentation, visual assets, database schemas, and algorithms contained in this repository are governed by the **[Custom License](LICENSE)** terms.

No individual or organization may copy, clone, distribute, reverse engineer, modify, sublicense, or use any portion of this project without prior explicit written permission from **Fenil Patel**. For full legal terms, see the [LICENSE](LICENSE) file.
