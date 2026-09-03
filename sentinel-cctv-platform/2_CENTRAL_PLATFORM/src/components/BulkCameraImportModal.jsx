import React, { useState, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Camera,
  Key,
  Video,
  Radio
} from 'lucide-react';

const SAMPLE_CSV_TEMPLATE = `name,camera_code,department_key,district,taluka,latitude,longitude,address,camera_type,rtsp_url,whep_url,hls_url
"01 Chiman bhai Bridge, Ahmedabad",GJ-AMD-CAM-001,HOME,Ahmedabad,City,23.0225,72.5714,"Near Ellis Bridge, Ashram Road",PTZ,rtsp://103.250.160.189:8554/stream/cam01,http://103.250.160.189:8889/stream/cam01/whep,https://cctv.corp8.cloud/cam01/index.m3u8
"02 Janpath Crossing, Ahmedabad",GJ-AMD-CAM-002,TRANSPORT,Ahmedabad,City,23.0335,72.5850,"Janpath Hotel Circle, Ashram Road",PTZ,rtsp://103.250.160.189:8554/stream/cam02,http://103.250.160.189:8889/stream/cam02/whep,https://cctv.corp8.cloud/cam02/index.m3u8
"03 Paldi Circle Junction",GJ-AMD-CAM-003,URBAN_DEV,Ahmedabad,Paldi,23.0125,72.5620,"Paldi Cross Roads, Ahmedabad",FIXED_BULLET,rtsp://103.250.160.189:8554/stream/cam04,http://103.250.160.189:8889/stream/cam04/whep,https://cctv.corp8.cloud/cam04/index.m3u8
"04 Tri Mandir Adalaj Tollnaka",GJ-GND-CAM-004,HOME,Gandhinagar,Adalaj,23.1678,72.5812,"SH-41 Highway, Adalaj Toll Plaza",ANPR_SPECIAL,rtsp://103.250.160.189:8554/stream/cam12,http://103.250.160.189:8889/stream/cam12/whep,https://cctv.corp8.cloud/cam12/index.m3u8
"05 Surat Dumas Road Checkpost",GJ-SRT-CAM-005,HOME,Surat,Choryasi,21.1500,72.7800,"Dumas Road Police Checkpost, Surat",DOME_INDOOR,rtsp://103.250.160.189:8554/stream/cam05,http://103.250.160.189:8889/stream/cam05/whep,https://cctv.corp8.cloud/cam05/index.m3u8`;

// Robust CSV row parser supporting quotes and commas inside strings
const parseCsvRow = (text) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      if (inQuotes && text[i + 1] === c) {
        cur += c;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
};

export const BulkCameraImportModal = ({
  isOpen,
  onClose,
  onImportStart,
  onImportSuccess,
  addToast,
  departments = []
}) => {
  const [file, setFile] = useState(null);
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'errors' | 'valid'
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_PAGE_SIZE = 50; // High-scale virtualization slice
  const fileInputRef = useRef(null);

  const handleDownloadTemplate = () => {
    try {
      const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'gujraksha_camera_onboarding_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (addToast) addToast('Sample CSV template downloaded successfully!', 'success', 'Template Downloaded');
    } catch (e) {
      window.open('/api/v1/onboarding/template-csv', '_blank');
    }
  };

  const processFile = (uploadedFile) => {
    if (!uploadedFile) return;
    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      if (addToast) addToast('Please select a valid .csv file.', 'error', 'Invalid File');
      return;
    }

    setFile(uploadedFile);
    setUploadResult(null);
    setPreviewPage(1);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvRawText(text);

      try {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
        if (lines.length < 2) {
          setParseErrors(['CSV file must contain a header row and at least one camera data row.']);
          setParsedRows([]);
          return;
        }

        const headers = parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''));
        const dataRows = lines.slice(1);
        const rows = [];
        const errs = [];

        for (let idx = 0; idx < dataRows.length; idx++) {
          const line = dataRows[idx];
          const parts = parseCsvRow(line);
          if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

          const rec = {};
          headers.forEach((h, i) => {
            rec[h] = parts[i] !== undefined ? parts[i].replace(/^["']|["']$/g, '').trim() : '';
          });

          const name = rec.name || rec.camera_name || rec.location || `Camera-${idx + 1}`;
          const latRaw = rec.latitude !== undefined && rec.latitude !== '' ? rec.latitude : (rec.lat || rec.gps_lat);
          const lngRaw = rec.longitude !== undefined && rec.longitude !== '' ? rec.longitude : (rec.lng || rec.lon || rec.gps_lng);
          const lat = parseFloat(latRaw);
          const lng = parseFloat(lngRaw);

          const isLatValid = !isNaN(lat) && lat >= -90 && lat <= 90;
          const isLngValid = !isNaN(lng) && lng >= -180 && lng <= 180;
          const isValidGps = isLatValid && isLngValid;

          if (!isValidGps) {
            errs.push(`Row ${idx + 2} (${name}): Invalid GPS (${latRaw || 'none'}, ${lngRaw || 'none'})`);
          }

          // Department Key resolution
          const rawKey = (rec.department_key || rec.dept_key || rec.key || rec.department_id || rec.department || rec.dept || rec.code || 'HOME').toUpperCase().trim();

          let matchedDept = null;
          if (departments.length > 0) {
            matchedDept = departments.find(d => (d.code || '').toUpperCase() === rawKey || (d.name || '').toUpperCase().includes(rawKey));
          }

          const deptCode = matchedDept ? matchedDept.code : rawKey;
          const deptName = matchedDept ? matchedDept.name : `${deptCode} Department`;

          const district = rec.district || rec.city || 'Ahmedabad';
          const cameraCode = rec.camera_code || rec.code || rec.asset_code || `GJ-${district.substring(0, 3).toUpperCase()}-CAM-${idx + 1}`;

          let camType = (rec.camera_type || rec.type || rec.hardware_type || 'PTZ').toUpperCase().trim();
          if (camType.includes('ANPR')) camType = 'ANPR_SPECIAL';
          else if (camType.includes('BULLET') || camType.includes('FIXED')) camType = 'FIXED_BULLET';
          else if (camType.includes('DOME')) camType = 'DOME_INDOOR';
          else camType = 'PTZ';

          // Extract all 3 stream endpoints
          const rtsp = rec.rtsp_url || rec.rtsp || '';
          const whep = rec.whep_url || rec.whep || '';
          const hls = rec.hls_url || rec.hls || '';
          const stream = rec.stream_url || rec.url || rtsp || whep || hls || '';

          rows.push({
            rowIndex: idx + 2,
            name,
            camera_code: cameraCode,
            department_id: deptCode,
            department_name: deptName,
            district,
            taluka: rec.taluka || '',
            address: rec.address || '',
            latitude: latRaw,
            longitude: lngRaw,
            parsedLat: lat,
            parsedLng: lng,
            isValidGps,
            camera_type: camType,
            stream_url: stream,
            rtsp_url: rtsp,
            whep_url: whep,
            hls_url: hls
          });
        }

        setParsedRows(rows);
        setParseErrors(errs);
      } catch (err) {
        setParseErrors([`Failed to parse CSV: ${err.message}`]);
        setParsedRows([]);
      }
    };
    reader.readAsText(uploadedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvRawText('');
    setParsedRows([]);
    setParseErrors([]);
    setUploadResult(null);
    setPreviewFilter('all');
    setPreviewPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!csvRawText.trim() || parsedRows.length === 0) {
      if (addToast) addToast('Please select a valid CSV file first.', 'error', 'No Data');
      return;
    }

    const validCount = parsedRows.filter(r => r.isValidGps).length;
    if (validCount === 0) {
      if (addToast) addToast('No valid camera rows to upload. Please fix GPS coordinates.', 'error', 'Validation Failed');
      return;
    }

    setIsUploading(true);
    if (onImportStart) onImportStart();

    try {
      const res = await fetch('/api/v1/onboarding/bulk-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csv: csvRawText })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult(data.data);
        if (addToast) {
          addToast(
            `Successfully onboarded ${data.data.successCount} cameras to the registry!`,
            'success',
            'Bulk Onboard Success'
          );
        }
        if (onImportSuccess) onImportSuccess();
      } else {
        const errorMsg = data.error?.message || data.message || 'Bulk upload failed';
        if (addToast) addToast(errorMsg, 'error', 'Upload Error');
      }
    } catch (err) {
      if (addToast) addToast(err.message || 'Network error during upload', 'error', 'Network Error');
    } finally {
      setIsUploading(false);
    }
  };

  // High-scale calculations
  const totalCount = parsedRows.length;
  const validRowCount = useMemo(() => parsedRows.filter(r => r.isValidGps).length, [parsedRows]);
  const invalidRowCount = useMemo(() => parsedRows.filter(r => !r.isValidGps).length, [parsedRows]);
  const uniqueDistricts = useMemo(() => new Set(parsedRows.map(r => r.district)).size, [parsedRows]);

  // Virtualized sliced list for UI preview (handles 10k rows with zero lag)
  const filteredRows = useMemo(() => {
    if (previewFilter === 'errors') return parsedRows.filter(r => !r.isValidGps);
    if (previewFilter === 'valid') return parsedRows.filter(r => r.isValidGps);
    return parsedRows;
  }, [parsedRows, previewFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE));
  const displayedRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredRows, previewPage]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal-lg" style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Modal Header */}
        <div className="modal-head" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Bulk CSV Camera Asset Onboarding</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-dim)' }}>
                High-scale batch ingestion supporting up to 80,000 CCTV camera nodes across Gujarat.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top Banner: Download Template & Instructions */}
          <div
            style={{
              background: 'rgba(34, 211, 238, 0.07)',
              border: '1px solid rgba(34, 211, 238, 0.25)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              flexShrink: 0
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} style={{ color: 'var(--accent)' }} /> Need the official CSV format?
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                Required: <strong>name, latitude, longitude, district, department_key</strong> (e.g. <code>HOME</code>, <code>TRANSPORT</code>) · Optional Stream URLs: <strong>whep_url</strong> (WebRTC browser view), <strong>hls_url</strong> (HLS playback), <strong>rtsp_url</strong> · Other: <strong>camera_code, taluka, address, camera_type</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm"
              onClick={handleDownloadTemplate}
              style={{
                background: 'rgba(34, 211, 238, 0.15)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                fontWeight: 700,
                fontSize: '12px',
                padding: '6px 14px',
                gap: '6px'
              }}
            >
              <Download size={14} strokeWidth={2.4} /> Download Sample CSV Template
            </button>
          </div>

          {/* Upload Result Alert */}
          {uploadResult && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#10b981' }}>
                  Successfully Registered {uploadResult.successCount} Camera Nodes!
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  All cameras and their live stream endpoints (RTSP / WHEP WebRTC / HLS) are registered into PostgreSQL.
                </div>
                {uploadResult.errorCount > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--warning)' }}>
                    {uploadResult.errorCount} row(s) had warnings or were skipped.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Drag & Drop File Zone */}
          {!file ? (
            <div
              className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragOver ? '2px dashed var(--accent)' : '2px dashed var(--panel-border)',
                background: isDragOver ? 'rgba(34, 211, 238, 0.12)' : 'var(--input-bg)',
                borderRadius: '10px',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FileSpreadsheet size={44} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag & Drop your Camera Metadata CSV file here (Supports 10,000+ rows)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                or <span style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 700 }}>Browse File</span> from your computer
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />
            </div>
          ) : (
            /* Selected File KPI Summary Cards */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              {/* File details bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '8px',
                  padding: '10px 16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={22} style={{ color: 'var(--accent)' }} />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleReset}
                  style={{ fontSize: '11.5px', padding: '4px 10px', gap: '5px' }}
                >
                  <Trash2 size={12} /> Change File
                </button>
              </div>

              {/* KPI Badges Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>Total Cameras</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalCount.toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10b981', fontWeight: 700 }}>Valid GPS</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#10b981' }}>{validRowCount.toLocaleString()}</div>
                </div>
                <div style={{ background: invalidRowCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--panel-bg)', border: invalidRowCount > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--panel-border)', borderRadius: '6px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: invalidRowCount > 0 ? '#ef4444' : 'var(--text-dim)', fontWeight: 700 }}>GPS Errors</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: invalidRowCount > 0 ? '#ef4444' : 'var(--text-dim)' }}>{invalidRowCount.toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.3)', borderRadius: '6px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#0284c7', fontWeight: 700 }}>Districts Covered</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#0284c7' }}>{uniqueDistricts}</div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings / Errors Box */}
          {parseErrors.length > 0 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11.5px',
                color: '#ef4444',
                maxHeight: '80px',
                overflowY: 'auto',
                flexShrink: 0
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                <AlertCircle size={13} /> {parseErrors.length} Issue(s) found in CSV:
              </div>
              {parseErrors.slice(0, 10).map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
              {parseErrors.length > 10 && (
                <div style={{ fontStyle: 'italic', marginTop: '2px', color: '#ef4444' }}>
                  ... and {parseErrors.length - 10} more rows with errors (click 'Errors Only' filter below to view).
                </div>
              )}
            </div>
          )}

          {/* Virtualized / Paginated Live Preview Table */}
          {parsedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Preview Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--input-bg)', padding: '3px', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
                  <button
                    type="button"
                    onClick={() => { setPreviewFilter('all'); setPreviewPage(1); }}
                    style={{
                      background: previewFilter === 'all' ? 'var(--accent)' : 'transparent',
                      color: previewFilter === 'all' ? '#000' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '11px',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    All ({totalCount.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreviewFilter('valid'); setPreviewPage(1); }}
                    style={{
                      background: previewFilter === 'valid' ? '#10b981' : 'transparent',
                      color: previewFilter === 'valid' ? '#000' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '11px',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Valid Only ({validRowCount.toLocaleString()})
                  </button>
                  {invalidRowCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { setPreviewFilter('errors'); setPreviewPage(1); }}
                      style={{
                        background: previewFilter === 'errors' ? '#ef4444' : 'transparent',
                        color: previewFilter === 'errors' ? '#fff' : '#f87171',
                        fontWeight: 700,
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Errors Only ({invalidRowCount.toLocaleString()})
                    </button>
                  )}
                </div>

                {/* Pagination Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                  <span>
                    Showing <strong>{((previewPage - 1) * PREVIEW_PAGE_SIZE) + 1}</strong>–<strong>{Math.min(previewPage * PREVIEW_PAGE_SIZE, filteredRows.length)}</strong> of <strong>{filteredRows.length.toLocaleString()}</strong>
                  </span>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                        style={{ padding: '2px 6px', height: '24px' }}
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <span style={{ padding: '2px 6px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {previewPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={previewPage >= totalPages}
                        onClick={() => setPreviewPage(p => Math.min(totalPages, p + 1))}
                        style={{ padding: '2px 6px', height: '24px' }}
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="table-wrap" style={{ flex: 1, minHeight: '180px', maxHeight: '300px', overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: '11.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>Row</th>
                      <th>Camera Name</th>
                      <th>Asset Code</th>
                      <th>Department</th>
                      <th>District</th>
                      <th>GPS Coordinates</th>
                      <th>Live Feeds</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((r, idx) => (
                      <tr key={idx} style={{ opacity: r.isValidGps ? 1 : 0.6, background: r.isValidGps ? 'transparent' : 'rgba(239, 68, 68, 0.06)' }}>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>#{r.rowIndex}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{r.camera_code}</td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 700 }}>
                            {r.department_id}
                          </span>
                        </td>
                        <td>{r.district}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {r.isValidGps ? (
                            <span style={{ color: '#4ade80' }}>
                              {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                            </span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>
                              Invalid ({r.latitude || 'empty'}, {r.longitude || 'empty'})
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {r.whep_url ? (
                              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '9.5px', padding: '1px 5px' }}>
                                WebRTC
                              </span>
                            ) : null}
                            {r.hls_url ? (
                              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '9.5px', padding: '1px 5px' }}>
                                HLS
                              </span>
                            ) : null}
                            {r.rtsp_url ? (
                              <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', fontSize: '9.5px', padding: '1px 5px' }}>
                                RTSP
                              </span>
                            ) : null}
                            {!r.whep_url && !r.hls_url && !r.rtsp_url && (
                              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Auto</span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '10.5px' }}>{r.camera_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-foot"
          style={{
            flexShrink: 0,
            padding: '12px 22px',
            borderTop: '1px solid var(--panel-border)',
            background: 'var(--panel-bg-solid)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button type="button" className="btn" onClick={onClose} disabled={isUploading}>
            {uploadResult ? 'Close' : 'Cancel'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {parsedRows.length > 0 && !uploadResult && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUploadSubmit}
                disabled={isUploading || validRowCount === 0}
                style={{
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  borderColor: '#38bdf8',
                  padding: '7px 18px',
                  fontWeight: 700
                }}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={14} className="spin-animation" /> Batch Ingesting {validRowCount.toLocaleString()} Cameras...
                  </>
                ) : (
                  <>
                    <Upload size={14} strokeWidth={2.4} /> Onboard All {validRowCount.toLocaleString()} Cameras to Database
                  </>
                )}
              </button>
            )}

            {uploadResult && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleReset();
                }}
                style={{ gap: '6px' }}
              >
                <Upload size={14} /> Import Another CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
