import React, { useState } from 'react';

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
      let csv = 'Camera Code,Name,Department,District,Taluka,Ownership,Camera Type,Latitude,Longitude,Status SLA,VMS Vendor';
      if (includeStreams) csv += ',Stream URL';
      csv += '\n';

      targetCameras.forEach(c => {
        csv += `"${c.camera_code}","${c.name}","${c.department_name || c.department_id}","${c.district}","${c.taluka || ''}","${c.ownership_type || ''}","${c.camera_type || ''}",${c.latitude},${c.longitude},"${c.status}","${c.vms_vendor || ''}"`;
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
      <div className="modal-card-clean">
        <div className="modal-header">
          <h3><i className="fa-solid fa-file-export"></i> CCTV Registry Export & Location Reports</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ fontWeight: 800, color: 'var(--accent-gold)' }}>Export File Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className={`btn-clean ${format === 'csv' ? 'btn-clean-gold' : 'btn-clean-outline'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setFormat('csv')}
              >
                <i className="fa-solid fa-file-csv"></i> CSV File
              </button>
              <button
                type="button"
                className={`btn-clean ${format === 'json' ? 'btn-clean-gold' : 'btn-clean-outline'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setFormat('json')}
              >
                <i className="fa-solid fa-file-code"></i> JSON Data
              </button>
              <button
                type="button"
                className={`btn-clean ${format === 'geojson' ? 'btn-clean-gold' : 'btn-clean-outline'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setFormat('geojson')}
              >
                <i className="fa-solid fa-map-location-dot"></i> GeoJSON GIS
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ fontWeight: 800, color: 'var(--accent-gold)' }}>Report Scope & Criteria</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="filter-select-clean"
              style={{ marginTop: '6px', width: '100%' }}
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
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: 700, color: 'var(--text-main)' }}>Select District Location</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="filter-select-clean"
                style={{ marginTop: '4px', width: '100%' }}
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
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontWeight: 700, color: 'var(--text-main)' }}>Select Camera Asset</label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="filter-select-clean"
                style={{ marginTop: '4px', width: '100%' }}
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

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeStreams}
                onChange={(e) => setIncludeStreams(e.target.checked)}
              />
              Include Stream URLs & Media Endpoints
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-clean btn-clean-outline" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button className="btn-clean btn-clean-gold" onClick={handleExport} style={{ flex: 2, justifyContent: 'center' }}>
              <i className="fa-solid fa-download"></i> Generate Location Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
