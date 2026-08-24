/**
 * GujRaksha — ANPR Detection Event Data Model
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 */

export class AnprDetectionModel {
  constructor(data = {}) {
    this.id = data.id || `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.vehicle_plate = (data.vehicle_plate || '').toUpperCase().trim();
    this.vehicle_type = data.vehicle_type || 'Motor Vehicle';
    this.vehicle_color = data.vehicle_color || 'Unknown';
    this.camera_id = data.camera_id || 'gov-feed-1';
    this.camera_code = data.camera_code || 'GJ-GOV-001';
    this.camera_name = data.camera_name || 'State CCTV Node';
    this.district = data.district || 'Ahmedabad';
    this.latitude = parseFloat(data.latitude || 23.0225);
    this.longitude = parseFloat(data.longitude || 72.5714);
    this.speed_kmh = parseInt(data.speed_kmh || 55, 10);
    this.confidence = parseFloat(data.confidence || 97.5);
    this.is_watchlist_hit = !!data.is_watchlist_hit;
    this.watchlist_category = data.watchlist_category || null;
    this.watchlist_fir = data.watchlist_fir || null;
    this.watchlist_ps = data.watchlist_ps || null;
    this.watchlist_priority = data.watchlist_priority || 'HIGH';
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  toSSEAlertPayload() {
    return {
      id: `alert-${this.id}`,
      type: 'ANPR_HOTLIST',
      title: `🚨 WATCHLIST ALERT: ${this.watchlist_category ? this.watchlist_category.replace('_', ' ') : 'SUSPECT DETECTED'}`,
      vehicleNo: this.vehicle_plate,
      description: `${this.vehicle_plate} (${this.vehicle_type}) · Matched ${this.watchlist_fir || 'Police Watchlist'} at ${this.speed_kmh} km/h`,
      severity: this.watchlist_category === 'STOLEN_VEHICLE' ? 'CRITICAL' : 'HIGH',
      cameraId: this.camera_id,
      cameraCode: this.camera_code,
      cameraName: this.camera_name,
      district: this.district,
      latitude: this.latitude,
      longitude: this.longitude,
      createdAt: Date.now(),
      timestamp: this.timestamp,
      isNew: true
    };
  }
}

export default AnprDetectionModel;
