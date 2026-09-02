import React from 'react';
import { Search, FileSpreadsheet, X, RotateCcw, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GUJARAT_DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
];

export const FloatingFilterBar = ({ filters, onFilterChange, onExportCsv, departments = [], isLoading = false }) => {
  const { isDeptAdmin, userDepartmentId, userDepartmentName } = useAuth();

  const hasActiveFilters = 
    (!isDeptAdmin && filters.department && filters.department !== 'ALL') ||
    (filters.district && filters.district !== 'ALL') ||
    (filters.status && filters.status !== 'ALL') ||
    (filters.detection_mode && filters.detection_mode !== 'ALL') ||
    (filters.search && filters.search.trim() !== '');

  const handleResetFilters = () => {
    if (isDeptAdmin && userDepartmentId !== 'ALL') {
      onFilterChange('department', userDepartmentId);
    } else {
      onFilterChange('department', 'ALL');
    }
    onFilterChange('district', 'ALL');
    onFilterChange('status', 'ALL');
    onFilterChange('detection_mode', 'ALL');
    onFilterChange('search', '');
  };

  return (
    <div className="floating filter-bar">
      {isLoading && <div className="filter-loading-bar" />}
      <div className="search-box">
        {isLoading ? (
          <Loader2 size={15} strokeWidth={2.5} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        ) : (
          <Search size={15} strokeWidth={2.2} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        )}
        <input
          type="text"
          id="mapSearch"
          placeholder={isLoading ? "Searching statewide cameras..." : "Search camera name, ID, or location…"}
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
        {filters.search && (
          <X
            size={14}
            style={{ cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0 }}
            onClick={() => onFilterChange('search', '')}
            title="Clear Search"
          />
        )}
      </div>

      {isDeptAdmin && userDepartmentId !== 'ALL' ? (
        <div className="filter-select" style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, cursor: 'not-allowed', background: 'var(--input-bg)' }}>
          <Lock size={12} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
            {userDepartmentName || userDepartmentId}
          </span>
        </div>
      ) : (
        <select
          className="filter-select"
          value={filters.department}
          onChange={(e) => onFilterChange('department', e.target.value)}
        >
          <option value="ALL">All Departments ({departments.length || '26+'})</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      <select
        className="filter-select"
        value={filters.district}
        onChange={(e) => onFilterChange('district', e.target.value)}
      >
        <option value="ALL">All Districts ({GUJARAT_DISTRICTS.length})</option>
        {GUJARAT_DISTRICTS.map((dist) => (
          <option key={dist} value={dist}>
            {dist}
          </option>
        ))}
      </select>

      <select
        className="filter-select"
        value={filters.detection_mode || 'ALL'}
        onChange={(e) => onFilterChange('detection_mode', e.target.value)}
        title="AI Detection & Analytics Mode"
      >
        <option value="ALL">All AI Modes</option>
        <option value="GENERAL_SURVEILLANCE">No AI</option>
        <option value="ANPR_DETECTION">ANPR</option>
        <option value="OBJECT_DETECTION">Object Detection</option>
        <option value="HYBRID_AI">ANPR + Object</option>
      </select>


      <select
        className="filter-select"
        value={filters.status}
        onChange={(e) => onFilterChange('status', e.target.value)}
      >
        <option value="ALL">All Statuses</option>
        <option value="ACTIVE">Active / Online</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="OFFLINE">Offline</option>
      </select>

      {hasActiveFilters && (
        <button
          className="btn btn-sm"
          onClick={handleResetFilters}
          title="Reset All Filters"
          style={{ gap: '4px', color: 'var(--accent)', borderColor: 'rgba(34, 211, 238, 0.3)' }}
        >
          <RotateCcw size={12} strokeWidth={2.2} /> Reset
        </button>
      )}

      <button className="btn btn-sm" onClick={onExportCsv} title="Export CSV Report">
        <FileSpreadsheet size={14} strokeWidth={2} /> CSV
      </button>
    </div>
  );
};
