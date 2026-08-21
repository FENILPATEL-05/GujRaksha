import React, { useState, useEffect } from 'react';
import { SquarePen, X, Trash2, Save } from 'lucide-react';

export const EditModal = ({ camera, onClose, onSaveSuccess, addToast, departments = [] }) => {
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
      const selectedDeptObj = departments.find(d => d.code === form.department_id);
      const payload = {
        ...form,
        department_name: selectedDeptObj ? selectedDeptObj.name : `${form.department_id} Department`
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
      <div className="modal modal-md">
        <div className="modal-head">
          <h3><SquarePen size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Edit Camera Asset Details</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Camera Asset Code</label>
                <input type="text" value={camera.camera_code} disabled style={{ opacity: 0.6 }} />
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
                  <option value="ANPR_SPECIAL">ANPR Special Camera</option>
                  <option value="FIXED_BULLET">Fixed Bullet Camera</option>
                  <option value="PTZ">PTZ Dome Camera</option>
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
                  value={form.vms_vendor}
                  onChange={(e) => setForm({ ...form, vms_vendor: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Address / Landmark</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="form-field span-2">
                <label>Stream URL (HTTP / MJPEG / RTSP / MP4)</label>
                <input
                  type="text"
                  placeholder="http://192.168.1.96:5000 or rtsp://..."
                  value={form.stream_url}
                  onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-foot" style={{ padding: '12px 0 0 0', marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={handleDelete}
              >
                <Trash2 size={14} strokeWidth={2} /> Delete
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
