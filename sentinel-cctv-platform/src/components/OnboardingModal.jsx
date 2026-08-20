import React, { useState } from 'react';

export const OnboardingModal = ({ isOpen, onClose, onRegisterSuccess, addToast }) => {
  const [activeTab, setActiveTab] = useState('manual');
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
  const [bulkResult, setBulkResult] = useState(null);

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
        addToast('Camera asset successfully registered into state CCTV registry!', 'success', 'Camera Registered');
        onClose();
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
        onRegisterSuccess();
      } else {
        addToast(data.error ? data.error.message : 'Unknown registration error', 'error', 'Registration Failed');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Connection Error');
    }
  };

  const handleCsvFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target.result;
      try {
        const res = await fetch('/api/v1/onboarding/bulk-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvText })
        });
        const data = await res.json();
        if (data.success) {
          addToast(`Bulk onboarding completed. Registered ${data.data.successCount} cameras.`, 'success', 'Bulk Success');
          setBulkResult(data.data);
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
      <div className="modal-card-3d">
        <div className="modal-header">
          <h3><i className="fa-solid fa-plus"></i> Onboard New Camera</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="tab-nav">
            <button className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>Manual Entry</button>
            <button className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Bulk CSV Import</button>
          </div>

          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Camera Name / Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SG Highway Junction Camera 1"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
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

                <div className="form-group">
                  <label>District *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmedabad"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Taluka / Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Sabarmati"
                    value={form.taluka}
                    onChange={(e) => setForm({ ...form, taluka: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ownership Type</label>
                  <select
                    value={form.ownership_type}
                    onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}
                  >
                    <option value="GOVERNMENT">Government Owned</option>
                    <option value="PRIVATE">Private / Commercial</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Latitude (GPS) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="23.0276"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Longitude (GPS) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="72.5074"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Camera Type</label>
                  <select
                    value={form.camera_type}
                    onChange={(e) => setForm({ ...form, camera_type: e.target.value })}
                  >
                    <option value="ANPR_SPECIAL">ANPR Special Camera</option>
                    <option value="FIXED_BULLET">Fixed Bullet Camera</option>
                    <option value="PTZ">PTZ Dome Camera</option>
                  </select>
                </div>

                <div className="form-group">
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

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Address / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Near SG Highway Flyover"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>VMS Vendor / Platform</label>
                  <input
                    type="text"
                    placeholder="e.g. Hikvision / Dahua"
                    value={form.vms_vendor}
                    onChange={(e) => setForm({ ...form, vms_vendor: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Stream URL (HTTP / MJPEG / RTSP / MP4)</label>
                  <input
                    type="text"
                    placeholder="http://192.168.1.96:5000 or rtsp://..."
                    value={form.stream_url}
                    onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn-3d btn-3d-gold btn-block" style={{ marginTop: '16px' }}>
                Register Camera
              </button>
            </form>
          )}

          {activeTab === 'bulk' && (
            <div>
              <div className="drop-zone">
                <i className="fa-solid fa-file-csv drop-icon"></i>
                <p>Drag & Drop Camera Metadata CSV file here or <label htmlFor="file-csv-onboard" className="file-label">Browse File</label></p>
                <input
                  id="file-csv-onboard"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleCsvFile(e.target.files[0])}
                />
                <small>Supported headers: name, latitude, longitude, department, district, vms_vendor, status, stream_url</small>
              </div>
              {bulkResult && (
                <div style={{ marginTop: '14px', fontSize: '0.82rem', color: '#22c55e' }}>
                  <i className="fa-solid fa-circle-check"></i> Registered {bulkResult.successCount} cameras.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
