import React, { useState } from 'react';
import { Camera, X, Check, FileSpreadsheet, CheckCircle2, ChevronRight, ChevronLeft, RefreshCw, AlertCircle, Sliders, Radio } from 'lucide-react';

const GUJARAT_DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
];

export const OnboardingModal = ({ isOpen, onClose, onRegisterSuccess, addToast, departments = [] }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedStream, setShowAdvancedStream] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    camera_code: '',
    department_id: departments.length > 0 ? departments[0].code : 'HOME',
    camera_type: 'PTZ',
    district: 'Ahmedabad',
    taluka: '',
    address: '',
    latitude: '',
    longitude: '',
    detection_mode: 'GENERAL_SURVEILLANCE', // Default No AI
    status: 'ACTIVE',
    stream_url: '',
    rtsp_url: '',
    whep_url: '',
    hls_url: ''
  });

  if (!isOpen) return null;

  const handleStreamUrlChange = (val) => {
    const nextForm = { ...form, stream_url: val };
    if (errors.stream_url) {
      setErrors((prev) => ({ ...prev, stream_url: undefined }));
    }

    const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
    const cleanId = (form.camera_code || '1').replace('gov-feed-', '').replace('cam-', '').trim() || '1';

    if (val.startsWith('rtsp://')) {
      nextForm.rtsp_url = val;
      nextForm.whep_url = `http://${host}:8889/stream/${cleanId}/whep`;
      nextForm.hls_url = `http://${host}:8888/stream/${cleanId}/index.m3u8`;
    } else if (val.endsWith('/whep') || val.includes(':8889/')) {
      nextForm.whep_url = val;
      nextForm.rtsp_url = `rtsp://${host}:8554/stream/${cleanId}`;
      nextForm.hls_url = `http://${host}:8888/stream/${cleanId}/index.m3u8`;
    } else if (val.trim()) {
      nextForm.rtsp_url = val;
      nextForm.whep_url = `http://${host}:8889/stream/${cleanId}/whep`;
      nextForm.hls_url = `http://${host}:8888/stream/${cleanId}/index.m3u8`;
    }
    setForm(nextForm);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!form.name || !form.name.trim()) {
        newErrors.name = 'Camera Name / Location is required';
      }
      if (!form.department_id) {
        newErrors.department_id = 'Department ownership is required';
      }
    }

    if (step === 2) {
      if (!form.district || !form.district.trim()) {
        newErrors.district = 'District is required';
      }
      if (!form.latitude || !String(form.latitude).trim()) {
        newErrors.latitude = 'Latitude (GPS) is required';
      } else {
        const lat = parseFloat(form.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          newErrors.latitude = 'Latitude must be between -90 and 90';
        }
      }

      if (!form.longitude || !String(form.longitude).trim()) {
        newErrors.longitude = 'Longitude (GPS) is required';
      } else {
        const lng = parseFloat(form.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          newErrors.longitude = 'Longitude must be between -180 and 180';
        }
      }
    }

    if (step === 3) {
      if (!form.stream_url || !form.stream_url.trim()) {
        newErrors.stream_url = 'Live Stream Feed URL is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep((prev) => Math.min(3, prev + 1));
    }
  };

  const handlePrev = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleManualSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setIsSubmitting(true);

    try {
      const selectedDeptObj = departments.find(d => d.code === form.department_id);
      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
      const cleanId = (form.camera_code || '1').replace('gov-feed-', '').replace('cam-', '').trim() || '1';

      const rtspUrl = form.rtsp_url.trim() || form.stream_url.trim();
      const whepUrl = form.whep_url.trim() || `http://${host}:8889/stream/${cleanId}/whep`;
      const hlsUrl = form.hls_url.trim() || `http://${host}:8888/stream/${cleanId}/index.m3u8`;

      const payload = {
        name: form.name.trim(),
        camera_code: form.camera_code.trim() || undefined,
        department_id: form.department_id,
        department_name: selectedDeptObj ? selectedDeptObj.name : `${form.department_id} Department`,
        camera_type: form.camera_type,
        district: form.district.trim(),
        taluka: form.taluka.trim(),
        address: form.address.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        detection_mode: form.detection_mode || 'GENERAL_SURVEILLANCE',
        enable_object_detection: form.detection_mode === 'OBJECT_DETECTION',
        status: form.status,
        stream_url: form.stream_url.trim(),
        rtsp_url: rtspUrl,
        whep_url: whepUrl,
        hls_url: hlsUrl,
        ownership_type: 'GOVERNMENT',
        vms_vendor: 'Live Sentinel Feeder',
        retention_days: 15,
        stream_properties: {
          resolution: '1920x1080',
          fps: 30,
          codec: 'H.264',
          bitrate: '4Mbps'
        },
        urls: {
          rtsp: rtspUrl,
          whep: whepUrl,
          hls: hlsUrl
        }
      };

      const res = await fetch('/api/v1/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (addToast) addToast(`Camera '${payload.name}' registered successfully!`, 'success', 'Camera Registered');
        setForm({
          name: '',
          camera_code: '',
          department_id: departments.length > 0 ? departments[0].code : 'HOME',
          camera_type: 'PTZ',
          district: 'Ahmedabad',
          taluka: '',
          address: '',
          latitude: '',
          longitude: '',
          detection_mode: 'GENERAL_SURVEILLANCE',
          status: 'ACTIVE',
          stream_url: '',
          rtsp_url: '',
          whep_url: '',
          hls_url: ''
        });
        setCurrentStep(1);
        setErrors({});
        onClose();
        if (onRegisterSuccess) onRegisterSuccess();
      } else {
        const msg = data.error ? (typeof data.error === 'string' ? data.error : data.error.message) : 'Registration failed';
        if (addToast) addToast(msg, 'error', 'Error');
      }
    } catch (err) {
      if (addToast) addToast(err.message || 'Network error', 'error', 'Network Error');
    } finally {
      setIsSubmitting(false);
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
          if (addToast) addToast(`Successfully registered ${data.data.successCount} cameras from CSV!`, 'success', 'Bulk Import');
          if (onRegisterSuccess) onRegisterSuccess();
        } else {
          if (addToast) addToast(data.error?.message || 'Bulk upload failed', 'error', 'Bulk Failed');
        }
      } catch (err) {
        if (addToast) addToast(err.message || 'Network error', 'error', 'Network Error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal-md" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div className="modal-head">
          <h3>
            <Camera size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Add New Camera Asset
          </h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '18px 24px' }}>
          {/* Tab Switcher */}
          <div className="tab-nav" style={{ marginBottom: '16px' }}>
            <button
              className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              Step-by-Step Entry
            </button>
            <button
              className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk CSV Import
            </button>
          </div>

          {activeTab === 'manual' && (
            <div>
              {/* Wizard Step Progress Bar */}
              <div className="wizard-stepper">
                <div
                  className={`wizard-step ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
                  onClick={() => currentStep > 1 && setCurrentStep(1)}
                >
                  <div className="wizard-step-circle">
                    {currentStep > 1 ? <Check size={14} strokeWidth={2.5} /> : '1'}
                  </div>
                  <div className="wizard-step-info">
                    <span className="wizard-step-title">Basic Info</span>
                    <span className="wizard-step-subtitle">Name & Department</span>
                  </div>
                </div>

                <div className={`wizard-step-divider ${currentStep > 1 ? 'active' : ''}`} />

                <div
                  className={`wizard-step ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
                  onClick={() => {
                    if (currentStep > 2 || (currentStep === 1 && validateStep(1))) {
                      setCurrentStep(2);
                    }
                  }}
                >
                  <div className="wizard-step-circle">
                    {currentStep > 2 ? <Check size={14} strokeWidth={2.5} /> : '2'}
                  </div>
                  <div className="wizard-step-info">
                    <span className="wizard-step-title">Location</span>
                    <span className="wizard-step-subtitle">District & Coordinates</span>
                  </div>
                </div>

                <div className={`wizard-step-divider ${currentStep > 2 ? 'active' : ''}`} />

                <div
                  className={`wizard-step ${currentStep === 3 ? 'active' : ''}`}
                  onClick={() => {
                    if (validateStep(1) && validateStep(2)) {
                      setCurrentStep(3);
                    }
                  }}
                >
                  <div className="wizard-step-circle">3</div>
                  <div className="wizard-step-info">
                    <span className="wizard-step-title">Stream & AI</span>
                    <span className="wizard-step-subtitle">AI Mode & Live Stream</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="form-grid" style={{ animation: 'modalFadeIn 0.2s ease' }}>
                  <div className="form-field span-2">
                    <label>Camera Name / Location *</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      className={errors.name ? 'input-error' : ''}
                      placeholder="e.g. SG Highway Junction PTZ"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                    />
                    {errors.name && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.name}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Asset Code (Optional Auto-Assigned)</label>
                    <input
                      type="text"
                      placeholder="e.g. GJ-GOV-045"
                      value={form.camera_code}
                      onChange={(e) => updateField('camera_code', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Department Ownership *</label>
                    <select
                      className={errors.department_id ? 'input-error' : ''}
                      value={form.department_id}
                      onChange={(e) => updateField('department_id', e.target.value)}
                    >
                      {departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {errors.department_id && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.department_id}
                      </span>
                    )}
                  </div>

                  <div className="form-field span-2">
                    <label>Camera Hardware Type</label>
                    <select
                      value={form.camera_type}
                      onChange={(e) => updateField('camera_type', e.target.value)}
                    >
                      <option value="PTZ">PTZ Dome Speed Camera</option>
                      <option value="FIXED_BULLET">Fixed Bullet HD Camera</option>
                      <option value="DOME_INDOOR">Dome Indoor Camera</option>
                      <option value="ANPR_SPECIAL">ANPR Special Camera</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Location & Geographic Coordinates */}
              {currentStep === 2 && (
                <div className="form-grid" style={{ animation: 'modalFadeIn 0.2s ease' }}>
                  <div className="form-field">
                    <label>District *</label>
                    <select
                      className={errors.district ? 'input-error' : ''}
                      value={form.district}
                      onChange={(e) => updateField('district', e.target.value)}
                    >
                      {GUJARAT_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.district && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.district}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Taluka / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Bodakdev / Daskroi"
                      value={form.taluka}
                      onChange={(e) => updateField('taluka', e.target.value)}
                    />
                  </div>

                  <div className="form-field span-2">
                    <label>Address / Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Pakwan Cross Road, SG Highway"
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Latitude (GPS) *</label>
                    <input
                      type="text"
                      required
                      className={errors.latitude ? 'input-error' : ''}
                      placeholder="e.g. 23.0338"
                      value={form.latitude}
                      onChange={(e) => updateField('latitude', e.target.value)}
                    />
                    {errors.latitude && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.latitude}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label>Longitude (GPS) *</label>
                    <input
                      type="text"
                      required
                      className={errors.longitude ? 'input-error' : ''}
                      placeholder="e.g. 72.5850"
                      value={form.longitude}
                      onChange={(e) => updateField('longitude', e.target.value)}
                    />
                    {errors.longitude && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.longitude}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Stream & AI Mode Setup */}
              {currentStep === 3 && (
                <div className="form-grid" style={{ animation: 'modalFadeIn 0.2s ease' }}>
                  <div className="form-field span-2">
                    <label>AI Detection & Analytics Mode *</label>
                    <select
                      value={form.detection_mode || 'GENERAL_SURVEILLANCE'}
                      onChange={(e) => updateField('detection_mode', e.target.value)}
                    >
                      <option value="GENERAL_SURVEILLANCE">No AI (Standard Feed)</option>
                      <option value="ANPR_DETECTION">ANPR (License Plate Recognition)</option>
                      <option value="OBJECT_DETECTION">Object Detection (Vehicle & Person)</option>
                      <option value="HYBRID_AI">ANPR + Object Detection (Dual Pipeline)</option>
                    </select>
                  </div>


                  <div className="form-field span-2">
                    <label>Camera Status SLA</label>
                    <select
                      value={form.status}
                      onChange={(e) => updateField('status', e.target.value)}
                    >
                      <option value="ACTIVE">ACTIVE / Online</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                      <option value="OFFLINE">OFFLINE</option>
                    </select>
                  </div>

                  {/* 1. RTSP Stream URL for Backend */}
                  <div className="form-field span-2">
                    <label style={{ color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={13} /> RTSP Stream URL (Backend Ingestion) *
                    </label>
                    <input
                      type="text"
                      className={errors.rtsp_url || errors.stream_url ? 'input-error' : ''}
                      placeholder="rtsp://127.0.0.1:8554/stream/1"
                      value={form.rtsp_url || form.stream_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleStreamUrlChange(val);
                      }}
                    />
                    {(errors.rtsp_url || errors.stream_url) && (
                      <span className="field-error-msg">
                        <AlertCircle size={11} strokeWidth={2.4} /> {errors.rtsp_url || errors.stream_url}
                      </span>
                    )}
                    <small style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                      Used by backend AI workers for object detection & license plate recognition.
                    </small>
                  </div>

                  {/* 2. WHEP WebRTC Stream URL for Frontend */}
                  <div className="form-field span-2">
                    <label style={{ color: '#4ade80', fontWeight: 700 }}>
                      WHEP WebRTC Playback URL (Frontend Live View)
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:8889/stream/1/whep"
                      value={form.whep_url}
                      onChange={(e) => updateField('whep_url', e.target.value)}
                    />
                    <small style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                      Used for zero-latency live streaming directly in web browser & video wall.
                    </small>
                  </div>

                  {/* 3. HTTP / HLS Stream URL */}
                  <div className="form-field span-2">
                    <label style={{ fontWeight: 700 }}>
                      HTTP / HLS Stream URL (.m3u8)
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:8888/stream/1/index.m3u8"
                      value={form.hls_url}
                      onChange={(e) => updateField('hls_url', e.target.value)}
                    />
                  </div>
                </div>
              )}



              {/* Wizard Footer Controls */}
              <div
                className="modal-foot"
                style={{
                  padding: '16px 0 0 0',
                  marginTop: '20px',
                  borderTop: '1px solid var(--panel-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      className="btn"
                      onClick={handlePrev}
                      disabled={isSubmitting}
                      style={{ gap: '6px' }}
                    >
                      <ChevronLeft size={14} strokeWidth={2} /> Previous
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleNext}
                      style={{ gap: '6px' }}
                    >
                      Next Step <ChevronRight size={14} strokeWidth={2} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleManualSubmit}
                      disabled={isSubmitting}
                      style={{ gap: '6px' }}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={14} className="spin-animation" /> Registering...
                        </>
                      ) : (
                        <>
                          <Check size={14} strokeWidth={2.4} /> Save & Register Camera
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bulk CSV Import Tab */}
          {activeTab === 'bulk' && (
            <div>
              <div className="drop-zone" style={{ padding: '30px 20px', textAlign: 'center', border: '2px dashed var(--panel-border)', borderRadius: '12px' }}>
                <FileSpreadsheet size={40} strokeWidth={1.5} style={{ color: 'var(--accent)', margin: '0 auto 10px', display: 'block' }} />
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                  Drag & Drop Camera Metadata CSV file here or{' '}
                  <label htmlFor="file-csv-onboard" style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>
                    Browse File
                  </label>
                </p>
                <input
                  id="file-csv-onboard"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleCsvFile(e.target.files[0])}
                />
                <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '11px' }}>
                  Supported CSV headers: name, camera_code, latitude, longitude, department, district, taluka, camera_type, stream_url, detection_mode
                </small>
              </div>

              {bulkResult && (
                <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <CheckCircle2 size={16} strokeWidth={2.2} /> Successfully onboarded {bulkResult.successCount} cameras!
                </div>
              )}

              <div className="modal-foot" style={{ padding: '16px 0 0 0', marginTop: '16px', borderTop: '1px solid var(--panel-border)' }}>
                <button type="button" className="btn" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


