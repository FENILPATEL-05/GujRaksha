import React, { useState } from 'react';
import {
  Camera,
  Cctv,
  Radar,
  Disc,
  Video,
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
  EyeOff,
  Building2,
  Lock,
  RefreshCw,
  Info,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Pagination } from './Pagination';
import { BulkCameraImportModal } from './BulkCameraImportModal';

const renderCameraTypeIcon = (type, size = 16) => {
  const normalized = String(type || '').toUpperCase();
  if (normalized.includes('ANPR')) {
    return <Zap size={size} strokeWidth={2.4} style={{ color: '#38bdf8' }} title="ANPR Special Camera" />;
  }
  if (normalized.includes('PTZ') || normalized.includes('SPEED')) {
    return <Radar size={size} strokeWidth={2.2} style={{ color: '#818cf8' }} title="PTZ Speed Dome Camera" />;
  }
  if (normalized.includes('DOME')) {
    return <Disc size={size} strokeWidth={2.2} style={{ color: '#34d399' }} title="Dome Indoor Camera" />;
  }
  if (normalized.includes('BULLET') || normalized.includes('FIXED')) {
    return <Video size={size} strokeWidth={2.2} style={{ color: '#f59e0b' }} title="Fixed Bullet HD Camera" />;
  }
  return <Cctv size={size} strokeWidth={2.2} style={{ color: 'var(--accent)' }} title="CCTV Camera Node" />;
};

const renderDetectionModeBadge = (mode) => {

  const normalized = String(mode || '').toUpperCase();
  if (normalized.includes('ANPR') && !normalized.includes('NO_ANPR') && !normalized.includes('GENERAL')) {
    return (
      <span
        className="badge-ai-mode anpr"
        title="ANPR Active: Automatic License Plate Recognition Enabled"
        style={{
          background: 'rgba(34, 211, 238, 0.16)',
          border: '1.2px solid rgba(34, 211, 238, 0.55)',
          color: '#38bdf8',
          fontWeight: 800,
          padding: '3px 8px',
          borderRadius: '6px',
          boxShadow: '0 0 10px -2px rgba(34, 211, 238, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px'
        }}
      >
        <Zap size={11} strokeWidth={2.6} style={{ color: '#38bdf8' }} />
        <span>ANPR ACTIVE</span>
      </span>

    );
  } else {
    return (
      <span
        className="badge-ai-mode surveillance"
        title="Standard Video Surveillance (No ANPR)"
        style={{
          background: 'rgba(100, 116, 139, 0.12)',
          border: '1px solid rgba(100, 116, 139, 0.25)',
          color: '#94a3b8',
          fontWeight: 500,
          padding: '3px 8px',
          borderRadius: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px'
        }}
      >
        <Eye size={11} strokeWidth={2} />
        <span>No ANPR</span>
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
  onBulkDeleteCameras,
  onExportCsv,
  onImportCsv,
  onAddCamera,
  onSyncFeeds,
  onRefresh,
  addToast,
  departments = [],
  isLoading = false,
  setIsLoading
}) => {
  const { isSuperAdmin, isDeptAdmin, isViewer, userDepartmentId, userDepartmentName, canManageCameras } = useAuth();
  const [selectedCameraForDetails, setSelectedCameraForDetails] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedCameraIds, setSelectedCameraIds] = useState(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);


  const handleSyncClick = async () => {
    if (!onSyncFeeds) return;
    setIsSyncing(true);
    try {
      await onSyncFeeds();
    } finally {
      setIsSyncing(false);
    }
  };


  // Pagination calculation
  const totalItems = cameras.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentCameras = cameras.slice(startIndex, startIndex + itemsPerPage);

  // Auto-clamp currentPage when dataset size shrinks
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setSelectedCameraForDetails(null);
    }
  };


  // Multi-Selection Handlers
  const isAllCurrentPageSelected = currentCameras.length > 0 && currentCameras.every(c => selectedCameraIds.has(c.id));
  const isSomeCurrentPageSelected = currentCameras.some(c => selectedCameraIds.has(c.id)) && !isAllCurrentPageSelected;

  const handleToggleSelectAllPage = () => {
    const next = new Set(selectedCameraIds);
    if (isAllCurrentPageSelected) {
      currentCameras.forEach(c => next.delete(c.id));
    } else {
      currentCameras.forEach(c => next.add(c.id));
    }
    setSelectedCameraIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(cameras.map(c => c.id));
    setSelectedCameraIds(next);
  };

  const handleToggleSelectRow = (id) => {
    const next = new Set(selectedCameraIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCameraIds(next);
  };

  const handleClearSelection = () => {
    setSelectedCameraIds(new Set());
  };

  const handleExecuteBulkDelete = async () => {
    if (!onBulkDeleteCameras || selectedCameraIds.size === 0) return;
    setIsDeletingBulk(true);
    try {
      await onBulkDeleteCameras(Array.from(selectedCameraIds));
      setSelectedCameraIds(new Set());
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleExecuteBulkANPR = async (enable) => {
    if (selectedCameraIds.size === 0) return;
    const mode = enable ? 'ANPR_DETECTION' : 'GENERAL_SURVEILLANCE';
    const label = enable ? 'ANPR AI Detection' : 'Standard Surveillance (No ANPR)';

    setIsUpdatingBulk(true);
    try {
      const res = await fetch('/api/v1/cameras/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedCameraIds),
          updateData: {
            detection_mode: mode
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (addToast) {
          addToast(
            `Successfully set ${selectedCameraIds.size} camera(s) to ${label}!`,
            'success',
            'Bulk AI Mode Updated'
          );
        }
        setSelectedCameraIds(new Set());
        if (onRefresh) onRefresh();
      } else {
        const msg = data.error?.message || data.message || 'Bulk AI mode update failed';
        if (addToast) addToast(msg, 'error', 'Error');
      }
    } catch (err) {
      if (addToast) addToast(err.message || 'Network error', 'error', 'Network Error');
    } finally {
      setIsUpdatingBulk(false);
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
        {/* Title & Count Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, whiteSpace: "nowrap" }}>
            Cameras
          </h2>
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--input-bg)',
            border: '1px solid var(--panel-border)',
            color: 'var(--text-secondary)'
          }}>
            {cameras.length} Assets
          </span>

          {isDeptAdmin && (
            <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--accent)', border: '1px solid rgba(34, 211, 238, 0.3)', fontSize: '11px', gap: '4px' }}>
              <Building2 size={11} strokeWidth={2.5} /> {userDepartmentName || userDepartmentId}
            </span>
          )}
        </div>

        {/* Right Side: Compact Search, Filter & Action Buttons */}
        <div className="toolbar-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* Compact Search Box */}
          <div className="search-box" style={{ width: '230px', minWidth: '180px', flex: 'none', height: '36px' }}>
            {isLoading ? (
              <Loader2 size={13} strokeWidth={2.5} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            ) : (
              <Search size={13} strokeWidth={2.2} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            )}
            <input
              type="text"
              placeholder={isLoading ? "Searching..." : "Search cameras..."}
              value={filters.search}
              onChange={(e) => {
                onFilterChange('search', e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '12px' }}
            />
            {filters.search && (
              <X
                size={12}
                style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                onClick={() => {
                  onFilterChange('search', '');
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          {/* Filter Popover Button */}
          <div style={{ position: 'relative', zIndex: 1000 }}>
            <button
              className="btn"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                height: '36px',
                padding: '0 11px',
                gap: '5px',
                fontSize: '12px',
                background: activeFilterCount > 0 ? 'rgba(34, 211, 238, 0.12)' : 'var(--input-bg)',
                borderColor: activeFilterCount > 0 ? 'var(--accent)' : 'var(--panel-border)',
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
                <div className="filter-popover-dropdown" style={{ right: 0, left: 'auto' }}>
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
                      <option value="ALL">All Districts</option>
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
                      <option value="ANPR_DETECTION">ANPR (Automatic License Plate Recognition)</option>
                      <option value="GENERAL_SURVEILLANCE">No ANPR (Standard Video Surveillance)</option>
                    </select>
                  </div>

                  <div className="filter-popover-field">
                    <label className="filter-popover-label">Status SLA</label>
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

          {onSyncFeeds && (
            <button
              className="btn"
              onClick={handleSyncClick}
              disabled={isSyncing}
              title="Sync & verify live camera stream feeds"
              style={{ height: '36px', padding: '0 11px', gap: '5px', fontSize: '12px' }}
            >
              <RefreshCw
                size={13}
                strokeWidth={2.2}
                style={{ animation: isSyncing ? 'radarSpin 1s linear infinite' : 'none' }}
              />
              <span>{isSyncing ? 'Syncing...' : 'Sync Feeds'}</span>
            </button>
          )}

          <button className="btn" onClick={onExportCsv} title="Export CSV, JSON, GeoJSON Reports" style={{ height: '36px', padding: '0 11px', gap: '5px', fontSize: '12px' }}>
            <FileSpreadsheet size={13} strokeWidth={2.2} /> <span>Export</span>
          </button>

          {canManageCameras && (
            <button
              className="btn"
              onClick={() => {
                if (onImportCsv) {
                  onImportCsv();
                } else {
                  setIsImportModalOpen(true);
                }
              }}
              title="Bulk Import Cameras via CSV File"
              style={{ height: '36px', padding: '0 11px', gap: '5px', fontSize: '12px' }}
            >
              <Upload size={13} strokeWidth={2.2} /> <span>Import</span>
            </button>
          )}
          
          {canManageCameras && (
            <button className="btn btn-primary" onClick={onAddCamera} title="Onboard New Camera Node" style={{ height: '36px', padding: '0 13px', gap: '5px', fontSize: '12px' }}>
              <Plus size={14} strokeWidth={2.4} /> <span>Add Camera</span>
            </button>
          )}
        </div>
      </div>


      {/* Active Filter Chips Bar */}
      {(activeFilterCount > 0 || (filters.search && filters.search.trim())) && (
        <div className="active-filters-strip">
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Active:
          </span>

          {filters.search && filters.search.trim() && (
            <div className="active-filter-chip">
              <span>Query: "{filters.search}"</span>
              <span className="active-filter-chip-remove" onClick={() => onFilterChange('search', '')}>
                <X size={11} />
              </span>
            </div>
          )}

          {filters.department && filters.department !== 'ALL' && (
            <div className="active-filter-chip">
              <span>Dept: {filters.department}</span>
              <span className="active-filter-chip-remove" onClick={() => onFilterChange('department', 'ALL')}>
                <X size={11} />
              </span>
            </div>
          )}

          {filters.district && filters.district !== 'ALL' && (
            <div className="active-filter-chip">
              <span>District: {filters.district}</span>
              <span className="active-filter-chip-remove" onClick={() => onFilterChange('district', 'ALL')}>
                <X size={11} />
              </span>
            </div>
          )}

          {filters.detection_mode && filters.detection_mode !== 'ALL' && (
            <div className="active-filter-chip">
              <span>Mode: {filters.detection_mode === 'ANPR_DETECTION' ? 'ANPR' : 'Standard'}</span>
              <span className="active-filter-chip-remove" onClick={() => onFilterChange('detection_mode', 'ALL')}>
                <X size={11} />
              </span>
            </div>
          )}

          {filters.status && filters.status !== 'ALL' && (
            <div className="active-filter-chip">
              <span>Status: {filters.status}</span>
              <span className="active-filter-chip-remove" onClick={() => onFilterChange('status', 'ALL')}>
                <X size={11} />
              </span>
            </div>
          )}

          <button
            className="filter-popover-reset"
            onClick={handleResetFilters}
            style={{ marginLeft: 'auto', fontSize: '11px' }}
          >
            Reset All
          </button>
        </div>
      )}

      {selectedCameraIds.size > 0 && (

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--panel-bg)',
            border: '1.5px solid rgba(239, 68, 68, 0.35)',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: 'var(--shadow-sm)',
            animation: 'modalFadeIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 800 }}>
                {selectedCameraIds.size}
              </span>
              Camera{selectedCameraIds.size > 1 ? 's' : ''} Selected
            </span>

            {totalItems > itemsPerPage && selectedCameraIds.size < totalItems && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleSelectAllFiltered}
                style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '6px', fontWeight: 600 }}
              >
                Select all {totalItems} matching cameras
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {canManageCameras && (
              <>
                {/* Bulk Turn ON ANPR */}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleExecuteBulkANPR(true)}
                  disabled={isUpdatingBulk || isDeletingBulk}
                  style={{
                    background: 'rgba(56, 189, 248, 0.16)',
                    borderColor: '#38bdf8',
                    color: '#38bdf8',
                    fontWeight: 700,
                    gap: '6px',
                    padding: '6px 13px',
                    fontSize: '11.5px'
                  }}
                  title="Enable ANPR Automatic License Plate Recognition on selected cameras"
                >
                  <Zap size={14} strokeWidth={2.4} /> {isUpdatingBulk ? 'Updating...' : `Turn ON ANPR (${selectedCameraIds.size})`}
                </button>

                {/* Bulk Turn OFF ANPR (No ANPR) */}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => handleExecuteBulkANPR(false)}
                  disabled={isUpdatingBulk || isDeletingBulk}
                  style={{
                    background: 'rgba(148, 163, 184, 0.12)',
                    borderColor: 'rgba(148, 163, 184, 0.35)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    gap: '6px',
                    padding: '6px 13px',
                    fontSize: '11.5px'
                  }}
                  title="Disable ANPR and set to standard surveillance"
                >
                  <EyeOff size={14} strokeWidth={2.2} /> {isUpdatingBulk ? 'Updating...' : `No ANPR / Standard (${selectedCameraIds.size})`}
                </button>

                {/* Bulk Delete */}
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleExecuteBulkDelete}
                  disabled={isDeletingBulk || isUpdatingBulk}
                  style={{ fontWeight: 700, gap: '6px', padding: '6px 14px', fontSize: '11.5px' }}
                >
                  <Trash2 size={14} strokeWidth={2.4} /> {isDeletingBulk ? 'Deleting...' : `Delete (${selectedCameraIds.size})`}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleClearSelection}
              style={{ gap: '4px', fontSize: '11px', padding: '6px 10px' }}
            >
              <X size={13} /> Deselect All
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap" style={{ position: 'relative' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(3, 7, 18, 0.76)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              borderRadius: '8px',
              gap: '10px'
            }}
          >
            <RefreshCw size={32} className="spin-animation" style={{ color: 'var(--accent)', animation: 'radarSpin 1s linear infinite' }} />
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>
              Ingesting & Synchronizing Camera Assets...
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
              Processing batch records and updating database registry...
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th style={{ width: '42px', textAlign: 'center', padding: '10px 8px' }}>
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  ref={el => { if (el) el.indeterminate = isSomeCurrentPageSelected; }}
                  onChange={handleToggleSelectAllPage}
                  title={isAllCurrentPageSelected ? "Deselect this page" : "Select all on this page"}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '15px', height: '15px' }}
                />
              </th>
              <th>Camera Node</th>
              <th>Department</th>
              <th>District</th>
              <th>AI Intelligence Mode</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCameras.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  {isLoading ? (
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={30} className="spin-animation" style={{ color: 'var(--accent)', animation: 'radarSpin 1s linear infinite' }} />
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#fff' }}>Ingesting & Loading Camera Registry...</div>
                    </div>
                  ) : (
                    <>
                      <FolderOpen size={36} strokeWidth={1.5} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                      <div>No camera assets match the search criteria.</div>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              currentCameras.map(cam => {
                const isSelected = selectedCameraIds.has(cam.id);
                const isActive = cam.status === 'ACTIVE';
                const isMaint = cam.status === 'MAINTENANCE';

                return (
                  <tr
                    key={cam.id}
                    style={{
                      background: isSelected
                        ? 'rgba(6, 182, 212, 0.12)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onClick={() => setSelectedCameraForDetails(cam)}
                  >
                    <td style={{ textAlign: 'center', padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(cam.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: '15px', height: '15px' }}
                      />
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            position: 'relative',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(34, 211, 238, 0.1)',
                            border: '1px solid rgba(34, 211, 238, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0
                          }}
                          title={`${cam.camera_type || 'PTZ'} Camera · Status: ${cam.status || 'ACTIVE'}`}
                        >
                          {renderCameraTypeIcon(cam.camera_type, 16)}
                          <span

                            style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              background: isActive ? '#10b981' : isMaint ? '#f59e0b' : '#ef4444',
                              boxShadow: isActive ? '0 0 8px #10b981' : isMaint ? '0 0 8px #f59e0b' : '0 0 8px #ef4444',
                              border: '2px solid #0f172a'
                            }}
                            title={`Status: ${cam.status || 'ACTIVE'}`}
                          />
                        </div>

                        <div>
                          <div className="cell-name" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cam.name}
                          </div>
                          <div className="cell-id" style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {cam.camera_code || cam.id} · <span style={{ color: 'var(--text-secondary)' }}>{cam.camera_type || 'PTZ'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="dept-tag">{cam.department_name || cam.department_id}</span>
                    </td>

                    <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {cam.district}
                    </td>

                    <td>
                      {renderDetectionModeBadge(cam.detection_mode)}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="View Full Camera Asset Details"
                          onClick={() => setSelectedCameraForDetails(cam)}
                          style={{ color: 'var(--accent)' }}
                        >
                          <Info size={14} strokeWidth={2.2} />
                        </button>

                        <button
                          title="Watch Live Stream"
                          onClick={() => onCameraSelect(cam)}
                        >
                          <Play size={13} strokeWidth={2} />
                        </button>

                        {canManageCameras && (
                          <>
                            <button
                              title="Edit Camera Details"
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

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

      {selectedCameraForDetails && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal modal-md" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-head" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(34, 211, 238, 0.12)',
                  border: '1px solid rgba(34, 211, 238, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)'
                }}>
                  {renderCameraTypeIcon(selectedCameraForDetails.camera_type, 18)}
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{selectedCameraForDetails.name}</span>
                    <span style={{
                      fontSize: '10.5px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      background: selectedCameraForDetails.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : selectedCameraForDetails.status === 'MAINTENANCE' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: selectedCameraForDetails.status === 'ACTIVE' ? '#10b981' : selectedCameraForDetails.status === 'MAINTENANCE' ? '#f59e0b' : '#ef4444',
                      border: `1px solid ${selectedCameraForDetails.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : selectedCameraForDetails.status === 'MAINTENANCE' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {selectedCameraForDetails.status || 'ACTIVE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {selectedCameraForDetails.camera_code || selectedCameraForDetails.id} · {selectedCameraForDetails.camera_type || 'PTZ Dome Camera'}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedCameraForDetails(null)}>
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div style={{
                background: (selectedCameraForDetails.detection_mode === 'ANPR_DETECTION' || selectedCameraForDetails.detection_mode === 'ANPR') ? 'rgba(34, 211, 238, 0.1)' : 'rgba(100, 116, 139, 0.08)',
                border: (selectedCameraForDetails.detection_mode === 'ANPR_DETECTION' || selectedCameraForDetails.detection_mode === 'ANPR') ? '1.5px solid rgba(34, 211, 238, 0.45)' : '1px solid var(--panel-border)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                    AI Intelligence & Computer Vision
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: (selectedCameraForDetails.detection_mode === 'ANPR_DETECTION' || selectedCameraForDetails.detection_mode === 'ANPR') ? '#38bdf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <Zap size={14} strokeWidth={2.4} />
                    <span>{(selectedCameraForDetails.detection_mode === 'ANPR_DETECTION' || selectedCameraForDetails.detection_mode === 'ANPR') ? 'ANPR Enabled (Automatic License Plate Recognition & Watchlist AI)' : 'No ANPR (General Surveillance Only)'}</span>
                  </div>
                </div>
                {renderDetectionModeBadge(selectedCameraForDetails.detection_mode)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Department</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.department_name || selectedCameraForDetails.department_id || 'Gujarat Police'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>District</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.district || 'Ahmedabad'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Taluka / Area</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.taluka || 'Urban Core'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Location Address / Landmark</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.address || selectedCameraForDetails.location_name || 'Gujarat Strategic Junction Point'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>GPS Coordinates</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {selectedCameraForDetails.latitude}, {selectedCameraForDetails.longitude}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Hardware Type</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.camera_type || 'PTZ Speed Dome'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Ownership</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.ownership_type || 'GOVERNMENT'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Codec & Resolution</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>
                    {selectedCameraForDetails.codec || selectedCameraForDetails.stream_properties?.codec || 'H.264'} · {selectedCameraForDetails.stream_properties?.resolution || '1080p'}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Retention SLA</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {selectedCameraForDetails.retention_days || 15} Days
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 800 }}>
                      WHEP WebRTC Live Stream URL (Zero Latency)
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ padding: '2px 8px', fontSize: '11px', gap: '4px' }}
                      onClick={() => {
                        const targetCam = selectedCameraForDetails;
                        setSelectedCameraForDetails(null);
                        onCameraSelect(targetCam);
                      }}
                    >
                      <Play size={11} strokeWidth={2.5} /> Open Live Feed
                    </button>
                  </div>
                  <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all' }}>
                    {(() => {
                      const currentHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
                      let raw = selectedCameraForDetails.whep_url || (selectedCameraForDetails.urls && selectedCameraForDetails.urls.whep) || (selectedCameraForDetails.stream_url && selectedCameraForDetails.stream_url.includes(':8889/') ? selectedCameraForDetails.stream_url : `http://${currentHost}:8889/stream/${String(selectedCameraForDetails.number || (selectedCameraForDetails.id || '').replace('gov-feed-', '').replace('cam-', '') || '1')}/whep`);
                      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
                        raw = raw.replace('localhost', currentHost).replace('127.0.0.1', currentHost);
                      }
                      return raw;
                    })()}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                    Primary RTSP Backend Stream URL
                  </div>
                  <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                    {selectedCameraForDetails.rtsp_url || (selectedCameraForDetails.urls && selectedCameraForDetails.urls.rtsp) || selectedCameraForDetails.stream_url || 'N/A'}
                  </div>
                </div>
              </div>
            </div>


            <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {canManageCameras && onEditCamera && (
                  <button
                    className="btn"
                    onClick={() => {
                      const targetCam = selectedCameraForDetails;
                      setSelectedCameraForDetails(null);
                      onEditCamera(targetCam);
                    }}
                    style={{ gap: '6px' }}
                  >
                    <SquarePen size={14} strokeWidth={2} /> Edit Asset Details
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const targetCam = selectedCameraForDetails;
                    setSelectedCameraForDetails(null);
                    onCameraSelect(targetCam);
                  }}
                  style={{ gap: '6px' }}
                >
                  <Play size={14} strokeWidth={2.4} /> Watch Stream
                </button>
                <button className="btn" onClick={() => setSelectedCameraForDetails(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkCameraImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportStart={() => {
          setIsImportModalOpen(false);
          if (setIsLoading) setIsLoading(true);
        }}
        onImportSuccess={() => {
          setIsImportModalOpen(false);
          setCurrentPage(1);
          setSelectedCameraIds(new Set());
          if (onRefresh) onRefresh();
        }}
        addToast={addToast}
        departments={departments}
      />
    </div>
  );
};
