import React from 'react';
import { Search, FileSpreadsheet } from 'lucide-react';

export const FloatingFilterBar = ({ filters, onFilterChange, onExportCsv, departments = [] }) => {
  return (
    <div className="floating filter-bar">
      <div className="search-box">
        <Search size={15} strokeWidth={2.2} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <input
          type="text"
          id="mapSearch"
          placeholder="Search camera name, ID or location…"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
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
        <option value="ALL">All Districts</option>
        <option value="Gandhinagar">Gandhinagar</option>
        <option value="Ahmedabad">Ahmedabad</option>
        <option value="Surat">Surat</option>
        <option value="Rajkot">Rajkot</option>
        <option value="Vadodara">Vadodara</option>
        <option value="Junagadh">Junagadh</option>
        <option value="Gir Somnath">Gir Somnath</option>
        <option value="Navsari">Navsari</option>
        <option value="Patan">Patan</option>
        <option value="Kutch">Kutch</option>
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

      <button className="btn btn-sm" onClick={onExportCsv} title="Export CSV Report">
        <FileSpreadsheet size={14} strokeWidth={2} /> CSV
      </button>
    </div>
  );
};
