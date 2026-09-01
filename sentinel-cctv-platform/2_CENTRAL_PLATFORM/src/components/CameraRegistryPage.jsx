import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Play,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  X,
  Loader2,
  Zap,
  Activity,
  Layers,
  Eye,
  Building2,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Pagination } from './Pagination';

const renderDetectionModeBadge = (mode) => {
  const normalized = String(mode || '').toUpperCase();
  if (normalized.includes('ANPR')) {
    return (
      <span className="badge-ai-mode anpr" title="AI Mode: ANPR Plate Detection (Automatic License Plate Recognition)">
        <Zap size={11} strokeWidth={2.4} />
        <span>ANPR Plate</span>
      </span>
    );
  } else if (normalized.includes('COUNT')) {
    return (
      <span className="badge-ai-mode counting" title="AI Mode: Vehicle Counting & Classification">
        <Layers size={11} strokeWidth={2.2} />
        <span>Vehicle Counting</span>
      </span>
    );
  } else if (normalized.includes('TRAFFIC')) {
    return (
      <span className="badge-ai-mode traffic" title="AI Mode: Traffic Flow & Speed Monitoring">
        <Activity size={11} strokeWidth={2.2} />
        <span>Traffic Flow</span>
      </span>
    );
  } else {
    return (
      <span className="badge-ai-mode surveillance" title="AI Mode: General Surveillance (Standard Video)">
        <Eye size={11} strokeWidth={2.2} />
        <span>Surveillance</span>
      </span>
    );
  }
};

export const CameraRegistryPage = ({
  cameras,
  filters,
  onFilterChange,
  onCameraSelect,
  onEditCamera,
  onDeleteCamera,
  onExportCsv,
  onAddCamera,
  departments = [],
  isLoading = false
}) => {
  const { isSuperAdmin, isDeptAdmin, isViewer, userDepartmentId, userDepartmentName, canManageCameras } = useAuth();
  const [expandedCameraId, setExpandedCameraId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Pagination calculation
  const totalItems = cameras.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCameras = cameras.slice(startIndex, startIndex + itemsPerPage);

  const toggleExpand = (id) => {
    setExpandedCameraId(prev => (prev === id ? null : id));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setExpandedCameraId(null);
    }
  };

  let activeFilterCount = 0;
  if (!isDeptAdmin && filters.department && filters.department !== 'ALL') activeFilterCount++;
  if (filters.district && filters.district !== 'ALL') activeFilterCount++;
  if (filters.status && filters.status !== 'ALL') activeFilterCount++;
  if (filters.detection_mode && filters.detection_mode !== 'ALL') activeFilterCount++;

  const handleResetFilters = () => {
    if (isDeptAdmin && userDepartmentId !== 'ALL') {
      onFilterChange('department', userDepartmentId);
    } else {
      onFilterChange('department', 'ALL');
    }
    onFilterChange('district', 'ALL');
    onFilterChange('status', 'ALL');
    onFilterChange('detection_mode', 'ALL');
    setCurrentPage(1);
  };

  return (
    <div className="table-view">
      {/* Unified Single-Row Search, Filter & Action Toolbar */}
      <div className="table-unified-toolbar">
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, whiteSpace: "nowrap" }}>
            Cameras
          </h2>
          {isDeptAdmin && (
            <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)', fontSize: '11px', gap: '4px' }}>
              <Building2 size={11} strokeWidth={2.5} /> {userDepartmentName || userDepartmentId}
            </span>
          )}
        </div>

        {/* Left Side: Search & Popover Filter Button */}
        <div className="toolbar-filters-group">
          <div className="search-box">
            {isLoading ? (
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            ) : (
              <Search size={14} strokeWidth={2.2} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            )}
            <input
              type="text"
              placeholder={isLoading ? "Searching statewide cameras..." : "Search ID, Location, District, VMS..."}
              value={filters.search}
              onChange={(e) => {
                onFilterChange('search', e.target.value);
                setCurrentPage(1);
              }}
            />
            {filters.search && (
              <X
                size={13}
                style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                onClick={() => {
                  onFilterChange('search', '');
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          {/* Single Filter Popover Button */}
          <div style={{ position: 'relative', zIndex: 1000 }}>
            <button
              className="btn"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                height: '36px',
                padding: '0 13px',
                gap: '6px',
                fontSize: '12px',
                background: activeFilterCount > 0 ? 'rgba(34, 211, 238, 0.15)' : 'rgba(30, 41, 59, 0.55)',
                borderColor: activeFilterCount > 0 ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)',
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text-primary)'
              }}
              title="Open Camera Filters"
            >
              <SlidersHorizontal size={13} strokeWidth={2.2} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--accent)',
                  color: '#000',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '10px'
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilterMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="filter-popover-dropdown">
                <div className="filter-popover-header">
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <SlidersHorizontal size={12} style={{ color: 'var(--accent)' }} /> Filter Options
                  </div>
                  {activeFilterCount > 0 && (
                    <button className="filter-popover-reset" onClick={handleResetFilters}>
                      Reset All
                    </button>
                  )}
                </div>

                <div className="filter-popover-field">
                  <label className="filter-popover-label">Department</label>
                  {isDeptAdmin && userDepartmentId !== 'ALL' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--panel-bg)', borderRadius: '6px', border: '1px solid var(--panel-border)', fontSize: '12px', color: 'var(--accent)' }}>
                      <Lock size={12} />
                      <span style={{ fontWeight: 600 }}>{userDepartmentName || userDepartmentId}</span>
                    </div>
                  ) : (
                    <select
                      className="filter-popover-select"
                      value={filters.department}
                      onChange={(e) => {
                        onFilterChange('department', e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="ALL">All Departments ({departments.length || '26+'})</option>
                      {departments.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="filter-popover-field">
                  <label className="filter-popover-label">District</label>
                  <select
                    className="filter-popover-select"
                    value={filters.district}
                    onChange={(e) => {
                      onFilterChange('district', e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="ALL">All Districts ({[
                      'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
                      'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
                      'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
                      'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
                      'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
                      'Tapi', 'Vadodara', 'Valsad'
                    ].length})</option>
                    {[
                      'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
                      'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
                      'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
                      'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
                      'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
                      'Tapi', 'Vadodara', 'Valsad'
                    ].map(dist => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-popover-field">
                  <label className="filter-popover-label">AI Detection & Analytics Mode</label>
                  <select
                    className="filter-popover-select"
                    value={filters.detection_mode || 'ALL'}
                    onChange={(e) => {
                      onFilterChange('detection_mode', e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="ALL">All AI Modes</option>
                    <option value="ANPR_DETECTION">ANPR Detection (Plate Recognition)</option>
                    <option value="VEHICLE_COUNTING">Vehicle Counting & Classification</option>
                    <option value="TRAFFIC_MONITORING">Traffic Flow & Speed Monitoring</option>
                    <option value="GENERAL_SURVEILLANCE">General Surveillance</option>
                  </select>
                </div>

                <div className="filter-popover-field">
                  <label className="filter-popover-label">Status</label>
                  <select
                    className="filter-popover-select"
                    value={filters.status}
                    onChange={(e) => {
                      onFilterChange('status', e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE / Online</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>
                </div>

                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowFilterMenu(false)}
                  style={{ marginTop: '4px', width: '100%', justifyContent: 'center' }}
                >
                  Apply Filters
                </button>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Export & Add Camera Button in the same line */}
        <div className="toolbar-actions-group">
          <button className="btn" onClick={onExportCsv} title="Export CSV, JSON, GeoJSON Reports" style={{ padding: '7px 12px', gap: '5px' }}>
            <FileSpreadsheet size={14} strokeWidth={2.2} /> Export Report
          </button>
          
          {canManageCameras && (
            <button className="btn btn-primary" onClick={onAddCamera} title="Onboard New Camera Node" style={{ padding: '7px 14px', gap: '6px' }}>
              <Plus size={15} strokeWidth={2.4} /> Add Camera
            </button>
          )}
        </div>
      </div>

      {/* Clean High-Density Data Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Camera</th>
              <th>Department</th>
              <th>District</th>
              <th>Type</th>
              <th>AI Detection & Analytics</th>
              <th>GPS Coordinates</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCameras.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <FolderOpen size={36} strokeWidth={1.5} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                  <div>No camera assets match the search criteria.</div>
                </td>
              </tr>
            ) : (
              currentCameras.map(cam => {
                const isExpanded = expandedCameraId === cam.id;
                const isActive = cam.status === 'ACTIVE';
                const isMaint = cam.status === 'MAINTENANCE';
                let statusClass = isActive ? 'active' : 'offline';
                if (isMaint) statusClass = 'maintenance';

                return (
                  <React.Fragment key={cam.id}>
                    <tr
                      style={{ background: isExpanded ? 'var(--hover-bg)' : 'transparent', cursor: 'pointer' }}
                      onClick={() => toggleExpand(cam.id)}
                    >
                      <td>
                        <div className="cell-name">{cam.name}</div>
                        <div className="cell-id">{cam.camera_code || cam.id}</div>
                      </td>

                      <td>
                        <span className="dept-tag">{cam.department_name || cam.department_id}</span>
                      </td>

                      <td style={{ color: 'var(--text-secondary)' }}>
                        {cam.district}
                      </td>

                      <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                        {cam.camera_type || 'ANPR_SPECIAL'}
                      </td>

                      <td>
                        {renderDetectionModeBadge(cam.detection_mode)}
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                        {cam.latitude}, {cam.longitude}
                      </td>

                      <td>
                        <span className={`badge ${statusClass}`}>{cam.status}</span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Expand Details"
                            onClick={() => toggleExpand(cam.id)}
                          >
                            {isExpanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                          </button>

                          <button
                            title="Watch Stream"
                            onClick={() => onCameraSelect(cam)}
                          >
                            <Play size={13} strokeWidth={2} />
                          </button>

                          {canManageCameras && (
                            <>
                              <button
                                title="Edit Details"
                                onClick={() => onEditCamera(cam)}
                              >
                                <SquarePen size={13} strokeWidth={2} />
                              </button>

                              {onDeleteCamera && (
                                <button
                                  title="Delete Camera Asset"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteCamera(cam);
                                  }}
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Trash2 size={13} strokeWidth={2} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Table Sub-Row Details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: '16px 20px', background: 'var(--input-bg)' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '12px'
                          }}>
                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Ownership Type</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.ownership_type || 'GOVERNMENT'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>VMS Feeder / Platform</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.vms_vendor || 'Live Sentinel Feeder'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Codec & Resolution</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>
                                {cam.codec || cam.stream_properties?.codec || 'H.264'} · {cam.stream_properties?.resolution || '1080p'} ({cam.stream_properties?.fps || 30}fps)
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Retention SLA</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.retention_days || 15} Days
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: cam.detection_mode === 'ANPR_DETECTION' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>AI Analytics Mode</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: cam.detection_mode === 'ANPR_DETECTION' ? '#4ade80' : 'var(--text-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {cam.detection_mode === 'ANPR_DETECTION' && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>}
                                {cam.detection_mode === 'ANPR_DETECTION' ? 'ANPR Plate Detection' : (cam.detection_mode === 'VEHICLE_COUNTING' ? 'Vehicle Counting' : (cam.detection_mode === 'TRAFFIC_MONITORING' ? 'Traffic Monitoring' : 'General Surveillance'))}
                              </div>
                            </div>

                            {/* WHEP Stream URL */}
                            <div style={{ gridColumn: 'span 2', background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.25)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '10px', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 800 }}>
                                  WHEP WebRTC Playback Endpoint
                                </div>
                                <button
                                  className="btn btn-sm btn-primary"
                                  style={{ padding: '2px 8px', fontSize: '10.5px', gap: '4px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCameraSelect(cam);
                                  }}
                                >
                                  <Play size={11} /> Play WHEP Feed
                                </button>
                              </div>
                                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: '4px', wordBreak: 'break-all' }}>
                                  {cam.whep_url || (cam.urls && cam.urls.whep) || (cam.stream_url && cam.stream_url.includes(':8889/') ? cam.stream_url : `http://${typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'}:8889/stream/${String(cam.number || (cam.id || '').replace('gov-feed-', '').replace('cam-', '') || '1')}/whep`)}
                                </div>
                            </div>

                            {/* RTSP / Ingest URL */}
                            <div style={{ gridColumn: 'span 2', background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                                Primary RTSP Stream URL
                              </div>
                              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all' }}>
                                {cam.rtsp_url || (cam.urls && cam.urls.rtsp) || cam.stream_url || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Rows-Per-Page Footer */}
      <div className="table-pagination-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Showing records <b>{totalItems === 0 ? 0 : startIndex + 1}</b> to <b>{Math.min(startIndex + itemsPerPage, totalItems)}</b> of <b>{totalItems}</b>
          </div>

          <div className="per-page-wrapper">
            <span>Rows per page:</span>
            <select
              className="filter-select per-page-select"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
};
