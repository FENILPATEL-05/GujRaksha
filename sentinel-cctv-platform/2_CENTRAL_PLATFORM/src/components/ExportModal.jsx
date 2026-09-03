import React, { useState } from 'react';
import { FileSpreadsheet, FileCode, MapPin, Download, X } from 'lucide-react';

export const ExportModal = ({ isOpen, onClose, cameras, addToast }) => {
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('filtered');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedCameraId, setSelectedCameraId] = useState('ALL');
  const [includeStreams, setIncludeStreams] = useState(true);

  if (!isOpen) return null;

  // Extract unique districts
  const districts = Array.from(new Set(cameras.map(c => c.district).filter(Boolean))).sort();

  const handleExport = () => {
    let targetCameras = [...cameras];

    if (scope === 'district_wise') {
      if (selectedDistrict !== 'ALL') {
        targetCameras = targetCameras.filter(c => c.district.toLowerCase() === selectedDistrict.toLowerCase());
      }
    } else if (scope === 'selected_camera') {
      if (selectedCameraId !== 'ALL') {
        targetCameras = targetCameras.filter(c => c.id === selectedCameraId || c.camera_code === selectedCameraId);
      }
    } else if (scope === 'active_only') {
      targetCameras = targetCameras.filter(c => c.status === 'ACTIVE');
    } else if (scope === 'police_only') {
      targetCameras = targetCameras.filter(c => c.department_id === 'HOME');
    } else if (scope === 'rto_only') {
      targetCameras = targetCameras.filter(c => c.department_id === 'TRANSPORT');
    }

    if (targetCameras.length === 0) {
      addToast('No camera records match the selected export criteria.', 'warning', 'Export Empty');
      return;
    }

    const scopeLabel = scope === 'district_wise' ? selectedDistrict.toLowerCase() : scope;

    if (format === 'csv') {
      let csv = 'Camera Code,Name,Department,District,Taluka,Ownership,Camera Type,AI Analytics Mode,Latitude,Longitude,Status SLA,VMS Vendor';
      if (includeStreams) csv += ',Stream URL';
      csv += '\n';

      targetCameras.forEach(c => {
        csv += `"${c.camera_code}","${c.name}","${c.department_name || c.department_id}","${c.district}","${c.taluka || ''}","${c.ownership_type || ''}","${c.camera_type || ''}","${c.detection_mode || 'TRAFFIC_MONITORING'}",${c.latitude},${c.longitude},"${c.status}","${c.vms_vendor || ''}"`;
        if (includeStreams) csv += `,"${c.stream_url || ''}"`;
        csv += '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gujarat_cctv_${scopeLabel}_report_${Date.now()}.csv`;
      a.click();
      addToast(`Exported ${targetCameras.length} camera records to CSV.`, 'success', 'Export Complete');
    } else if (format === 'json') {
      const dataStr = JSON.stringify(targetCameras, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gujarat_cctv_${scopeLabel}_report_${Date.now()}.json`;
      a.click();
      addToast(`Exported ${targetCameras.length} camera records to JSON.`, 'success', 'Export Complete');
    } else if (format === 'geojson') {
      const geojson = {
        type: 'FeatureCollection',
        features: targetCameras.map(c => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [c.longitude, c.latitude]
          },
          properties: {
            id: c.id,
            camera_code: c.camera_code,
            name: c.name,
            department: c.department_name || c.department_id,
            district: c.district,
            camera_type: c.camera_type,
            detection_mode: c.detection_mode || 'TRAFFIC_MONITORING',
            status: c.status,
            stream_url: c.stream_url
          }
        }))
      };

      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gujarat_cctv_${scopeLabel}_report_${Date.now()}.geojson`;
      a.click();
      addToast(`Exported ${targetCameras.length} GIS features to GeoJSON.`, 'success', 'Export Complete');
    }

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm" style={{ maxWidth: '460px', width: '92%' }}>
        <div className="modal-head">
          <h3><FileSpreadsheet size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Export & Location Reports</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div className="form-field" style={{ marginBottom: '14px' }}>
            <label>Export File Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${format === 'csv' ? 'btn-primary' : ''}`}
                onClick={() => setFormat('csv')}
              >
                <FileSpreadsheet size={14} strokeWidth={2} /> CSV
              </button>
              <button
                type="button"
                className={`btn btn-sm ${format === 'json' ? 'btn-primary' : ''}`}
                onClick={() => setFormat('json')}
              >
                <FileCode size={14} strokeWidth={2} /> JSON
              </button>
              <button
                type="button"
                className={`btn btn-sm ${format === 'geojson' ? 'btn-primary' : ''}`}
                onClick={() => setFormat('geojson')}
              >
                <MapPin size={14} strokeWidth={2} /> GeoJSON
              </button>
            </div>
          </div>

          <div className="form-field" style={{ marginBottom: '14px' }}>
            <label>Report Scope & Criteria</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              style={{ marginTop: '6px' }}
            >
              <option value="filtered">Currently Filtered Cameras ({cameras.length})</option>
              <option value="district_wise">Location / District-Wise Report</option>
              <option value="selected_camera">Single Selected Camera Report</option>
              <option value="active_only">Active / Online Cameras Only</option>
              <option value="police_only">Gujarat Police Feeds Only</option>
              <option value="rto_only">Gujarat RTO / Transport Feeds Only</option>
            </select>
          </div>

          {scope === 'district_wise' && (
            <div className="form-field" style={{ marginBottom: '14px' }}>
              <label>Select District Location</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                style={{ marginTop: '4px' }}
              >
                <option value="ALL">All Districts ({cameras.length} cameras)</option>
                {districts.map(d => {
                  const count = cameras.filter(c => c.district === d).length;
                  return (
                    <option key={d} value={d}>
                      {d} District ({count} cameras)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {scope === 'selected_camera' && (
            <div className="form-field" style={{ marginBottom: '14px' }}>
              <label>Select Camera Asset</label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                style={{ marginTop: '4px' }}
              >
                <option value="ALL">Select Camera Node...</option>
                {cameras.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.camera_code}] {c.name} ({c.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-field" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', fontSize: '13px' }}>
              <input
                type="checkbox"
                style={{ height: 'auto', width: 'auto' }}
                checked={includeStreams}
                onChange={(e) => setIncludeStreams(e.target.checked)}
              />
              Include Stream URLs & Media Endpoints
            </label>
          </div>

          <div className="modal-foot" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={14} strokeWidth={2.2} /> Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
