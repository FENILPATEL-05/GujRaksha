import React from 'react';

export const FloatingFilterBar = ({ filters, onFilterChange, onExportCsv }) => {
  return (
    <div className="floating-filter-bar">
      <div style={{ position: 'relative' }}>
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
        <input
          type="text"
          className="filter-input-clean"
          placeholder="Search Camera ID, Junction, District..."
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>

      <select
        className="filter-select-clean"
        value={filters.department}
        onChange={(e) => onFilterChange('department', e.target.value)}
      >
        <option value="ALL">All Departments</option>
        <option value="HOME">Police / Home Dept</option>
        <option value="TRANSPORT">RTO / Transport</option>
        <option value="CIVIL_SUPPLIES">Civil Supplies</option>
        <option value="PORTS">Maritime Ports</option>
        <option value="PRIVATE_FEED">Private Feeder</option>
      </select>

      <select
        className="filter-select-clean"
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
        className="filter-select-clean"
        value={filters.status}
        onChange={(e) => onFilterChange('status', e.target.value)}
      >
        <option value="ALL">All Statuses</option>
        <option value="ACTIVE">Active / Online</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="OFFLINE">Offline</option>
      </select>

      <button className="btn-clean btn-clean-outline" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={onExportCsv} title="Export CSV">
        <i className="fa-solid fa-file-export"></i> CSV
      </button>
    </div>
  );
};
