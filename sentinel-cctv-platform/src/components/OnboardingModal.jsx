import React, { useState } from 'react';
import { Camera, X, Check, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export const OnboardingModal = ({ isOpen, onClose, onRegisterSuccess, addToast }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [bulkResult, setBulkResult] = useState(null);
  const [form, setForm] = useState({
    name: '',
    department_id: 'HOME',
    district: '',
    taluka: '',
    latitude: '',
    longitude: '',
    address: '',
    ownership_type: 'GOVERNMENT',
    camera_type: 'ANPR_SPECIAL',
    vms_vendor: '',
    status: 'ACTIVE',
    stream_url: ''
  });

  if (!isOpen) return null;

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        addToast('New Camera Successfully Onboarded into Registry!', 'success', 'Camera Registered');
        setForm({
          name: '',
          department_id: 'HOME',
          district: '',
          taluka: '',
          latitude: '',
          longitude: '',
          address: '',
          ownership_type: 'GOVERNMENT',
          camera_type: 'ANPR_SPECIAL',
          vms_vendor: '',
          status: 'ACTIVE',
          stream_url: ''
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
      <div className="modal modal-md">
        <div className="modal-head">
          <h3><Camera size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Onboard New Camera</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body">
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
                    placeholder="e.g. SG Highway Junction Camera 1"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Department Ownership *</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value="HOME">Home Dept / Gujarat Police</option>
                    <option value="TRANSPORT">Transport Dept / RTO Gujarat</option>
                    <option value="CIVIL_SUPPLIES">Food & Civil Supplies</option>
                    <option value="PORTS">Gujarat Maritime Board / Ports</option>
                    <option value="PRIVATE_FEED">Private Commercial Feeder</option>
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
                    <option value="ANPR_SPECIAL">ANPR Special</option>
                    <option value="DOME_PTZ">Dome PTZ Speed</option>
                    <option value="BULLET_FIXED">Bullet Fixed HD</option>
                    <option value="PANORAMIC_360">Panoramic 360°</option>
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
                  <label>VMS Vendor / Platform</label>
                  <input
                    type="text"
                    placeholder="e.g. Hikvision / Dahua"
                    value={form.vms_vendor}
                    onChange={(e) => setForm({ ...form, vms_vendor: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Address / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Near SG Highway Flyover"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div className="form-field full">
                  <label>Stream URL (HTTP / MJPEG / RTSP / MP4)</label>
                  <input
                    type="text"
                    placeholder="http://192.168.1.96:5000 or rtsp://..."
                    value={form.stream_url}
                    onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-foot" style={{ padding: '12px 0 0 0', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={14} strokeWidth={2.4} /> Register Camera
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
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-dim)' }}>Supported headers: name, latitude, longitude, department, district, vms_vendor, status, stream_url</small>
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
