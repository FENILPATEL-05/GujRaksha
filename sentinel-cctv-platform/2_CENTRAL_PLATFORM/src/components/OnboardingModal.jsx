import React, { useState } from 'react';
import { Camera, X, Check, CheckCircle2, ChevronRight, ChevronLeft, RefreshCw, AlertCircle, Sliders, Radio, Zap } from 'lucide-react';

const GUJARAT_DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
];

export const OnboardingModal = ({ isOpen, onClose, onRegisterSuccess, addToast, departments = [] }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedStream, setShowAdvancedStream] = useState(false);
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
        const title = (data.error && typeof data.error === 'object' && data.error.code && data.error.code.startsWith('DUPLICATE')) ? 'Duplicate Camera' : 'Registration Error';
        if (addToast) addToast(msg, 'error', title);
      }
    } catch (err) {
      if (addToast) addToast(err.message || 'Network error', 'error', 'Network Error');
    } finally {
      setIsSubmitting(false);
    }
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
                  {/* Row 1: Camera Name + Asset Code */}
                  <div className="form-field">
                    <label>Camera Name / Location *</label>
                    <input
                      type="text"
                      autoFocus
                      required
                      className={errors.name ? 'input-error' : ''}
                      placeholder="Enter camera name or location"
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
                      placeholder="Enter camera asset code"
                      value={form.camera_code}
                      onChange={(e) => updateField('camera_code', e.target.value)}
                    />
                  </div>


                  {/* Row 2: Highlighted ANPR Intelligence Mode Field */}
                  <div
                    className="form-field span-2"
                    style={{
                      background: 'rgba(34, 211, 238, 0.08)',
                      border: '1.5px solid rgba(34, 211, 238, 0.45)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      boxShadow: '0 0 16px -3px rgba(34, 211, 238, 0.25)'
                    }}
                  >
                    <label style={{ color: '#38bdf8', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Zap size={14} strokeWidth={2.4} style={{ color: '#38bdf8' }} />
                      <span>ANPR Intelligence Mode *</span>
                      <span style={{ fontSize: '10px', background: 'rgba(34, 211, 238, 0.2)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>Core AI Feature</span>
                    </label>
                    <select
                      value={form.detection_mode === 'ANPR_DETECTION' || form.detection_mode === 'ANPR' ? 'ANPR_DETECTION' : 'GENERAL_SURVEILLANCE'}
                      onChange={(e) => updateField('detection_mode', e.target.value)}
                      style={{
                        background: 'var(--input-bg)',
                        borderColor: 'rgba(34, 211, 238, 0.5)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '13px',
                        padding: '8px 12px',
                        borderRadius: '6px'
                      }}
                    >
                      <option value="ANPR_DETECTION">ANPR (Automatic License Plate Recognition & Live AI Search)</option>
                      <option value="GENERAL_SURVEILLANCE">No ANPR (Standard Video Surveillance Only)</option>
                    </select>
                    <small style={{ color: 'var(--text-dim)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                      {form.detection_mode === 'ANPR_DETECTION' || form.detection_mode === 'ANPR'
                        ? 'ANPR Enabled: Python AI workers will scan number plates, log detections to DB, and match suspect watchlists.'
                        : 'Standard Mode: Camera will be used for general live surveillance without automatic plate recognition.'}
                    </small>
                  </div>


                  {/* Row 3: Department Ownership + Camera Hardware Type */}
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

                  <div className="form-field">
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
                      placeholder="Enter taluka or area"
                      value={form.taluka}
                      onChange={(e) => updateField('taluka', e.target.value)}
                    />
                  </div>

                  <div className="form-field span-2">
                    <label>Address / Landmark</label>
                    <input
                      type="text"
                      placeholder="Enter address or landmark"
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
                      placeholder="Enter GPS latitude"
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
                      placeholder="Enter GPS longitude"
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

              {/* Step 3: Stream & Live Feed Setup */}
              {currentStep === 3 && (
                <div className="form-grid" style={{ animation: 'modalFadeIn 0.2s ease' }}>




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
                      placeholder="Enter RTSP stream URL"
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
                      placeholder="Enter WHEP WebRTC playback URL"
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
                      placeholder="Enter HLS stream playback URL"
                      value={form.hls_url}
                      onChange={(e) => updateField('hls_url', e.target.value)}
                    />
                  </div>

                </div>
              )}

            </div>
          </div>

        {/* Fixed Modal Footer */}
        <div
          className="modal-foot"
          style={{
            flexShrink: 0,
            padding: '14px 24px',
            borderTop: '1px solid var(--panel-border)',
            background: 'var(--panel-bg-solid)',
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
    </div>
  );
};



