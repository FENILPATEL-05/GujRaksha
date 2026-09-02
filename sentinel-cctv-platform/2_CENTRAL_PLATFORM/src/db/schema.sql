-- PostgreSQL 16 DDL Schema
-- GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
-- Copyright (c) 2026 Fenil Patel. All Rights Reserved.

-- 1. Departments Master Table
CREATE TABLE IF NOT EXISTS departments (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nodal_officer VARCHAR(150),
    contact_email VARCHAR(150),
    contact_phone VARCHAR(50),
    color VARCHAR(20) DEFAULT '#22d3ee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 2. Cameras Master Table
CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR(100) PRIMARY KEY,
    camera_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(50) NOT NULL,
    department_name VARCHAR(150),
    district VARCHAR(100) NOT NULL,
    taluka VARCHAR(100),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    ownership_type VARCHAR(50) DEFAULT 'GOVERNMENT',
    camera_type VARCHAR(50) DEFAULT 'PTZ',
    detection_mode VARCHAR(50) DEFAULT 'TRAFFIC_MONITORING',
    vms_vendor VARCHAR(150),
    stream_url TEXT,
    rtsp_url TEXT,
    whep_url TEXT,
    hls_url TEXT,
    codec VARCHAR(50) DEFAULT 'H.264',
    retention_days INT DEFAULT 15,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    installation_date VARCHAR(50),
    stream_properties JSONB DEFAULT '{}'::jsonb,
    urls JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-speed search and filtering on 80,000+ camera nodes
CREATE INDEX IF NOT EXISTS idx_cameras_dept ON cameras(department_id);
CREATE INDEX IF NOT EXISTS idx_cameras_district ON cameras(district);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE INDEX IF NOT EXISTS idx_cameras_detection_mode ON cameras(detection_mode);
CREATE INDEX IF NOT EXISTS idx_cameras_lat_lng ON cameras(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cameras_dept_dist_status ON cameras(department_id, district, status);
CREATE INDEX IF NOT EXISTS idx_cameras_created ON cameras(created_at DESC);

-- 3. Watchlist Master Table
CREATE TABLE IF NOT EXISTS watchlist (
    id VARCHAR(100) PRIMARY KEY,
    vehicle_plate VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) DEFAULT 'STOLEN_VEHICLE',
    fir_number VARCHAR(100),
    police_station VARCHAR(150),
    owner_name VARCHAR(150),
    priority VARCHAR(50) DEFAULT 'HIGH',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_watchlist_plate ON watchlist(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_watchlist_category ON watchlist(category);

-- 4. ANPR Detections & Event Logs Table
CREATE TABLE IF NOT EXISTS anpr_detections (
    id VARCHAR(100) PRIMARY KEY,
    vehicle_plate VARCHAR(50) NOT NULL,
    confidence INT DEFAULT 95,
    camera_id VARCHAR(100),
    camera_code VARCHAR(100),
    camera_name VARCHAR(255),
    district VARCHAR(100),
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    speed_kmh INT DEFAULT 45,
    vehicle_type VARCHAR(100) DEFAULT 'Sedan / Car',
    is_watchlist_hit BOOLEAN DEFAULT FALSE,
    watchlist_category VARCHAR(100),
    watchlist_fir VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anpr_plate ON anpr_detections(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_anpr_camera ON anpr_detections(camera_code);
CREATE INDEX IF NOT EXISTS idx_anpr_timestamp ON anpr_detections(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anpr_watchlist_hit ON anpr_detections(is_watchlist_hit);

-- 5. Camera Audit Logs Table
CREATE TABLE IF NOT EXISTS camera_audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    camera_id VARCHAR(100),
    performed_by VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    changes_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
