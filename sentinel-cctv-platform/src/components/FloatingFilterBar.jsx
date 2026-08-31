import React from 'react';
import { Search, FileSpreadsheet, X, RotateCcw, Loader2 } from 'lucide-react';

const GUJARAT_DISTRICTS = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
];

export const FloatingFilterBar = ({ filters, onFilterChange, onExportCsv, departments = [], isLoading = false }) => {
  const hasActiveFilters = 
    (filters.department && filters.department !== 'ALL') ||
    (filters.district && filters.district !== 'ALL') ||
    (filters.status && filters.status !== 'ALL') ||
    (filters.search && filters.search.trim() !== '');

  const handleResetFilters = () => {
    onFilterChange('department', 'ALL');
    onFilterChange('district', 'ALL');
    onFilterChange('status', 'ALL');
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
