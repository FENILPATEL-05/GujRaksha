import React, { useState, useEffect } from 'react';
import { SquarePen, X, Trash2, Save, Radio, Sliders } from 'lucide-react';

export const EditModal = ({ camera, onClose, onSaveSuccess, addToast, departments = [] }) => {
  const [showAdvancedStream, setShowAdvancedStream] = useState(false);

  const [form, setForm] = useState({
    name: '',
    camera_code: '',
    department_id: 'HOME',
    district: '',
    taluka: '',
    latitude: '',
    longitude: '',
    address: '',
    ownership_type: 'GOVERNMENT',
    camera_type: 'PTZ',
    vms_vendor: '',
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

  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name || '',
        camera_code: camera.camera_code || '',
        department_id: camera.department_id || 'HOME',
        district: camera.district || '',
        taluka: camera.taluka || '',
        latitude: camera.latitude !== undefined ? camera.latitude : '',
        longitude: camera.longitude !== undefined ? camera.longitude : '',
        address: camera.address || '',
        ownership_type: camera.ownership_type || 'GOVERNMENT',
        camera_type: camera.camera_type || 'PTZ',
        vms_vendor: camera.vms_vendor || '',
        status: camera.status || 'ACTIVE',
        stream_url: camera.stream_url || '',
        rtsp_url: camera.rtsp_url || (camera.urls && camera.urls.rtsp) || '',
        whep_url: camera.whep_url || (camera.urls && camera.urls.whep) || '',
        hls_url: camera.hls_url || (camera.urls && camera.urls.hls) || '',
        codec: camera.codec || (camera.stream_properties && camera.stream_properties.codec) || 'H.264',
        resolution: (camera.stream_properties && camera.stream_properties.resolution) || camera.resolution || '1920x1080',
        fps: (camera.stream_properties && camera.stream_properties.fps) || camera.fps || 30,
        bitrate: (camera.stream_properties && camera.stream_properties.bitrate) || camera.bitrate || '4Mbps',
        retention_days: camera.retention_days || 15
      });
    }
  }, [camera]);

  if (!camera) return null;

  const handleStreamUrlChange = (val) => {
    const nextForm = { ...form, stream_url: val };
    if (val.startsWith('rtsp://')) {
      nextForm.rtsp_url = val;
      const match = val.match(/rtsp:\/\/([^:/]+):?(\d*)\/(.+)/);
      if (match) {
        const host = match[1] || 'localhost';
        const pathPart = match[3];
        nextForm.whep_url = `http://${host}:8889/${pathPart}/whep`;
        nextForm.hls_url = `http://${host}/live/${pathPart}/index.m3u8`;
      }
    } else if (val.endsWith('/whep') || val.includes(':8889/')) {
      nextForm.whep_url = val;
      const match = val.match(/https?:\/\/([^:/]+):?(\d*)\/(.+)\/whep/);
      if (match) {
        const host = match[1] || 'localhost';
        const pathPart = match[3];
        nextForm.rtsp_url = `rtsp://${host}:8554/${pathPart}`;
        nextForm.hls_url = `http://${host}/live/${pathPart}/index.m3u8`;
      }
    }
    setForm(nextForm);
  };

  const handleSubmit = async (e) => {
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

      const res = await fetch(`/api/v1/cameras/${camera.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Camera details successfully updated!', 'success', 'Camera Saved');
        onClose();
        onSaveSuccess();
      } else {
        addToast(data.error ? data.error.message : 'Update failed', 'error', 'Update Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove camera '${camera.name}' [${camera.camera_code}] from the registry?`)) return;

    try {
      const res = await fetch(`/api/v1/cameras/${camera.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('Camera successfully deleted.', 'success', 'Camera Removed');
        onClose();
        onSaveSuccess();
      } else {
        addToast(data.error ? data.error.message : 'Deletion failed', 'error', 'Delete Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <h3><SquarePen size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Edit Camera Asset Details</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Camera Asset Code</label>
                <input type="text" value={form.camera_code || camera.camera_code} onChange={(e) => setForm({ ...form, camera_code: e.target.value })} />
              </div>

              <div className="form-field span-2">
                <label>Camera Name / Location *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Department Ownership</label>
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
                <label>District</label>
                <input
                  type="text"
                  required
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Taluka / Area</label>
                <input
                  type="text"
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
                  <option value="GOVERNMENT">Government Owned</option>
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
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Longitude *</label>
                <input
                  type="text"
                  required
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
                  value={form.vms_vendor}
                  onChange={(e) => setForm({ ...form, vms_vendor: e.target.value })}
                />
              </div>

              <div className="form-field span-2">
                <label>Address / Landmark</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              {/* Stream Endpoints & WHEP Section */}
              <div className="form-field span-2" style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '12px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)' }}>
                    <Radio size={14} /> Stream Endpoints & WHEP Configuration
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
                  Primary Stream URL (RTSP / HTTP / WHEP)
                </label>
                <input
                  type="text"
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

            <div className="modal-foot" style={{ padding: '14px 0 0 0', marginTop: '14px', borderTop: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={handleDelete}
              >
                <Trash2 size={14} strokeWidth={2} /> Delete Asset
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={14} strokeWidth={2.4} /> Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
