import React, { useState, useEffect } from 'react';

export const EditModal = ({ camera, onClose, onSaveSuccess, addToast }) => {
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

  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name || '',
        department_id: camera.department_id || 'HOME',
        district: camera.district || '',
        taluka: camera.taluka || '',
        latitude: camera.latitude !== undefined ? camera.latitude : '',
        longitude: camera.longitude !== undefined ? camera.longitude : '',
        address: camera.address || '',
        ownership_type: camera.ownership_type || 'GOVERNMENT',
        camera_type: camera.camera_type || 'ANPR_SPECIAL',
        vms_vendor: camera.vms_vendor || '',
        status: camera.status || 'ACTIVE',
        stream_url: camera.stream_url || ''
      });
    }
  }, [camera]);

  if (!camera) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/cameras/${camera.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
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
      <div className="modal-card-3d">
        <div className="modal-header">
          <h3><i className="fa-solid fa-pen-to-square"></i> Edit Camera Asset Details</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Camera Asset Code</label>
                <input type="text" value={camera.camera_code} disabled style={{ opacity: 0.6 }} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Camera Name / Location *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Department Ownership</label>
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
                <label>District</label>
                <input
                  type="text"
                  required
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Taluka / Area</label>
                <input
                  type="text"
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
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>VMS Vendor / Platform</label>
                <input
                  type="text"
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-3d btn-3d-outline"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
                onClick={handleDelete}
              >
                <i className="fa-solid fa-trash"></i> Delete
              </button>
              <button type="submit" className="btn-3d btn-3d-gold" style={{ flex: 1 }}>
                <i className="fa-solid fa-floppy-disk"></i> Save Camera Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
