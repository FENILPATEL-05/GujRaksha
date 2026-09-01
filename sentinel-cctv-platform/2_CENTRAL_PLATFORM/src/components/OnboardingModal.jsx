import React, { useState } from 'react';
import { Camera, X, Check, FileSpreadsheet, CheckCircle2, Radio, Sliders, Layers } from 'lucide-react';

export const OnboardingModal = ({ isOpen, onClose, onRegisterSuccess, addToast, departments = [] }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [bulkResult, setBulkResult] = useState(null);
  const [showAdvancedStream, setShowAdvancedStream] = useState(false);

  const [form, setForm] = useState({
    name: '',
    camera_code: '',
    department_id: departments.length > 0 ? departments[0].code : 'HOME',
    district: '',
    taluka: '',
    latitude: '',
    longitude: '',
    address: '',
    ownership_type: 'GOVERNMENT',
    camera_type: 'PTZ',
    detection_mode: 'GENERAL_SURVEILLANCE',
    vms_vendor: 'Live Sentinel Feeder (H264/MP4)',
    status: 'ACTIVE',
    stream_url: '',
    rtsp_url: '',
    whep_url: '',
    hls_url: '',
    codec: 'H.264',
    resolution: '1920x1080',
    fps: 30,
    bitrate: '4Mbps',
    retention_days: 15
  });

  if (!isOpen) return null;

  // Auto-sync WHEP & HLS URLs when RTSP/Stream URL changes
  const handleStreamUrlChange = (val) => {
    const nextForm = { ...form, stream_url: val };
    const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
    if (val.startsWith('rtsp://')) {
      nextForm.rtsp_url = val;
      nextForm.whep_url = `http://${host}:8889/stream/1/whep`;
      nextForm.hls_url = `http://${host}:8888/stream/1/index.m3u8`;
    } else if (val.endsWith('/whep') || val.includes(':8889/')) {
      nextForm.whep_url = val;
      nextForm.rtsp_url = `rtsp://${host}:8554/stream/1`;
      nextForm.hls_url = `http://${host}:8888/stream/1/index.m3u8`;
    }
    setForm(nextForm);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedDeptObj = departments.find(d => d.code === form.department_id);
      const payload = {
        ...form,
        department_name: selectedDeptObj ? selectedDeptObj.name : `${form.department_id} Department`,
        urls: {
          rtsp: form.rtsp_url || form.stream_url || '',
          whep: form.whep_url || '',
          hls: form.hls_url || ''
        },
        stream_properties: {
          resolution: form.resolution || '1920x1080',
          fps: parseInt(form.fps || 30, 10),
          codec: form.codec || 'H.264',
          bitrate: form.bitrate || '4Mbps'
        }
      };

      const res = await fetch('/api/v1/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('New Camera Successfully Onboarded into Registry!', 'success', 'Camera Registered');
        setForm({
          name: '',
          camera_code: '',
          department_id: departments.length > 0 ? departments[0].code : 'HOME',
          district: '',
          taluka: '',
          latitude: '',
          longitude: '',
          address: '',
          ownership_type: 'GOVERNMENT',
          camera_type: 'PTZ',
          detection_mode: 'GENERAL_SURVEILLANCE',
          vms_vendor: 'Live Sentinel Feeder (H264/MP4)',
          status: 'ACTIVE',
          stream_url: '',
          rtsp_url: '',
          whep_url: '',
          hls_url: '',
          codec: 'H.264',
          resolution: '1920x1080',
          fps: 30,
          bitrate: '4Mbps',
          retention_days: 15
        });
        onClose();
        onRegisterSuccess();
      } else {
        addToast(data.error ? data.error.message : 'Registration failed', 'error', 'Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    }
  };

  const handleCsvFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target.result;
      try {
        const res = await fetch('/api/v1/onboarding/bulk-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: csvContent
        });
        const data = await res.json();
        if (data.success) {
          setBulkResult(data.data);
          addToast(`Successfully registered ${data.data.successCount} cameras from CSV!`, 'success', 'Bulk Import');
          onRegisterSuccess();
        } else {
          addToast(data.error.message, 'error', 'Bulk Failed');
        }
      } catch (err) {
        addToast(err.message, 'error', 'Network Error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <h3><Camera size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Onboard New Camera</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          <div className="tab-nav">
            <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>Manual Entry</button>
            <button className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Bulk CSV Import</button>
          </div>

          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit}>
              <div className="form-grid">
                <div className="form-field span-2">
                  <label>Camera Name / Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Camera 32 (SG Highway Junction)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Asset Code (Optional Auto-Assigned)</label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-GOV-032"
                    value={form.camera_code}
                    onChange={(e) => setForm({ ...form, camera_code: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Department Ownership *</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>District *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmedabad"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Taluka / Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Sabarmati"
                    value={form.taluka}
                    onChange={(e) => setForm({ ...form, taluka: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Ownership Type</label>
                  <select
                    value={form.ownership_type}
                    onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}
                  >
                    <option value="GOVERNMENT">Government Asset</option>
                    <option value="PRIVATE_PARTNER">Private Partner</option>
                    <option value="MUNICIPAL">Municipal Corporation</option>
                    <option value="PRIVATE">Private / Commercial</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Latitude *</label>
                  <input
                    type="text"
                    required
                    placeholder="23.0225"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Longitude *</label>
                  <input
                    type="text"
                    required
                    placeholder="72.5714"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Camera Type</label>
                  <select
                    value={form.camera_type}
                    onChange={(e) => setForm({ ...form, camera_type: e.target.value })}
                  >
                    <option value="PTZ">PTZ Dome Speed Camera</option>
                    <option value="FIXED_BULLET">Fixed Bullet HD Camera</option>
                    <option value="DOME_INDOOR">Dome Indoor Camera</option>
                    <option value="ANPR_SPECIAL">ANPR Special Camera</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>AI Detection & Analytics Mode *</label>
                  <select
                    value={form.detection_mode}
                    onChange={(e) => setForm({ ...form, detection_mode: e.target.value })}
                  >
                    <option value="GENERAL_SURVEILLANCE">General Surveillance (Standard Feed / No AI)</option>
                    <option value="ANPR_DETECTION">ANPR Detection (Automatic License Plate Recognition)</option>
                    <option value="VEHICLE_COUNTING">Vehicle Counting & Classification</option>
                    <option value="TRAFFIC_MONITORING">Traffic Flow & Speed Monitoring</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Status SLA</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE / Online</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>VMS Vendor / Feeder</label>
                  <input
                    type="text"
                    placeholder="e.g. Live Sentinel Feeder (H264/MP4)"
                    value={form.vms_vendor}
                    onChange={(e) => setForm({ ...form, vms_vendor: e.target.value })}
                  />
                </div>

                <div className="form-field span-2">
                  <label>Address / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Near SG Highway Flyover, Chimanbhai Bridge"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                {/* Stream Configuration Section */}
                <div className="form-field span-2" style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '12px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
                      <Radio size={14} /> Stream Endpoints & WHEP Protocols
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setShowAdvancedStream(!showAdvancedStream)}
                    >
                      <Sliders size={11} /> {showAdvancedStream ? 'Hide Advanced Options' : 'Show Advanced Options'}
                    </button>
                  </div>

                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Primary RTSP Stream URL (Auto-syncs WHEP & HLS endpoints)
                  </label>
                  <input
                    type="text"
                    placeholder="rtsp://localhost:8554/stream/1"
                    value={form.stream_url}
                    onChange={(e) => handleStreamUrlChange(e.target.value)}
                  />
                </div>

                {showAdvancedStream && (
                  <>
                    <div className="form-field span-2">
                      <label style={{ color: 'var(--success)', fontWeight: 600 }}>
                        WHEP WebRTC Playback URL (Ultra Low Latency HTTP POST)
                      </label>
                      <input
                        type="text"
                        placeholder="http://localhost:8889/stream/1/whep"
                        value={form.whep_url}
                        onChange={(e) => setForm({ ...form, whep_url: e.target.value })}
                      />
                    </div>

                    <div className="form-field span-2">
                      <label>HLS Direct Playback URL (.m3u8)</label>
                      <input
                        type="text"
                        placeholder="http://localhost/live/stream/1/index.m3u8"
                        value={form.hls_url}
                        onChange={(e) => setForm({ ...form, hls_url: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Video Codec</label>
                      <select
                        value={form.codec}
                        onChange={(e) => setForm({ ...form, codec: e.target.value })}
                      >
                        <option value="H.264">H.264 (AVC)</option>
                        <option value="H.265">H.265 (HEVC)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Stream Resolution</label>
                      <select
                        value={form.resolution}
                        onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                      >
                        <option value="1920x1080">1920x1080 (1080p FHD)</option>
                        <option value="1280x720">1280x720 (720p HD)</option>
                        <option value="3840x2160">3840x2160 (4K UHD)</option>
                        <option value="640x480">640x480 (VGA)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Frame Rate (FPS)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={form.fps}
                        onChange={(e) => setForm({ ...form, fps: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Target Bitrate</label>
                      <input
                        type="text"
                        placeholder="4Mbps"
                        value={form.bitrate}
                        onChange={(e) => setForm({ ...form, bitrate: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Retention Days</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={form.retention_days}
                        onChange={(e) => setForm({ ...form, retention_days: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-foot" style={{ padding: '14px 0 0 0', marginTop: '14px', borderTop: '1px solid var(--panel-border)' }}>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={14} strokeWidth={2.4} /> Register Camera Asset
                </button>
              </div>
            </form>
          )}

          {activeTab === 'bulk' && (
            <div>
              <div className="drop-zone">
                <FileSpreadsheet size={38} strokeWidth={1.5} style={{ color: 'var(--accent)', margin: '0 auto 10px', display: 'block' }} />
                <p>Drag & Drop Camera Metadata CSV file here or <label htmlFor="file-csv-onboard" className="file-label" style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>Browse File</label></p>
                <input
                  id="file-csv-onboard"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleCsvFile(e.target.files[0])}
                />
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-dim)' }}>
                  Supported headers: name, camera_code, latitude, longitude, department, district, taluka, ownership, camera_type, vms_vendor, status, stream_url, whep_url, rtsp_url, hls_url, codec, retention_days
                </small>
              </div>
              {bulkResult && (
                <div style={{ marginTop: '14px', fontSize: '0.82rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <CheckCircle2 size={15} strokeWidth={2} /> Registered {bulkResult.successCount} cameras.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
