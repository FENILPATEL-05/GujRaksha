-- PostgreSQL 16 + PostGIS 3.4 Spatial DDL Schema
-- Gujarat Sentinel Industrial CCTV Platform

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Camera Master Asset Registry Table
CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(50) NOT NULL,
    department_name VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL,
    taluka VARCHAR(100),
    location GEOGRAPHY(Point, 4326) NOT NULL,
    address TEXT,
    ownership_type VARCHAR(20) CHECK (ownership_type IN ('GOVERNMENT', 'PRIVATE')),
    camera_type VARCHAR(50) CHECK (camera_type IN ('FIXED_BULLET', 'PTZ_360', 'DOME', 'ANPR_SPECIAL')),
    vms_vendor VARCHAR(100),
    stream_url_encrypted TEXT,
    retention_days INT DEFAULT 7,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE')),
    installation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spatial GIST Index for Sub-Millisecond Spatial Range & Radius Searches
CREATE INDEX IF NOT EXISTS idx_cameras_location ON cameras USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_cameras_dept_status ON cameras(department_id, status);
CREATE INDEX IF NOT EXISTS idx_cameras_district ON cameras(district);

-- Camera Audit Logs Table
CREATE TABLE IF NOT EXISTS camera_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    performed_by VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    changes_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
