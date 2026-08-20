import React from 'react';

export const Sidebar = ({
  cameras,
  filters,
  onFilterChange,
  onCameraSelect,
  onEditCamera,
  onExportCsv
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3><i className="fa-solid fa-filter"></i> Statewide GIS Registry</h3>
        <span className="badge-police-red" style={{ fontSize: '0.62rem' }}>MODEL 1 FOUNDATION</span>
      </div>

      <div className="search-box">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input
          type="text"
          placeholder="Search Camera ID, Junction, District, VMS..."
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label><i className="fa-solid fa-sitemap"></i> Department Ownership</label>
        <select
          value={filters.department}
          onChange={(e) => onFilterChange('department', e.target.value)}
        >
          <option value="ALL">All 26 Gujarat Government Depts</option>
          <option value="HOME">Home Department / Gujarat Police</option>
          <option value="TRANSPORT">Transport Department / RTO Gujarat</option>
          <option value="CIVIL_SUPPLIES">Food & Civil Supplies Department</option>
          <option value="PORTS">Gujarat Maritime Board / Ports</option>
          <option value="PRIVATE_FEED">Private Commercial Feeder</option>
        </select>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label><i className="fa-solid fa-location-dot"></i> District</label>
          <select
            value={filters.district}
            onChange={(e) => onFilterChange('district', e.target.value)}
          >
            <option value="ALL">All Districts</option>
            <option value="Gandhinagar">Gandhinagar Capital</option>
            <option value="Ahmedabad">Ahmedabad Metro</option>
            <option value="Surat">Surat District</option>
            <option value="Rajkot">Rajkot District</option>
            <option value="Vadodara">Vadodara District</option>
            <option value="Junagadh">Junagadh Range</option>
            <option value="Gir Somnath">Gir Somnath Range</option>
            <option value="Navsari">Navsari District</option>
            <option value="Patan">Patan Range</option>
            <option value="Kutch">Kutch District</option>
          </select>
        </div>

        <div className="filter-group">
          <label><i className="fa-solid fa-heart-pulse"></i> Status SLA</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active / Online</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>
      </div>

      <div className="asset-count-label">
        <span>Showing {cameras.length} registered nodes</span>
        <button className="btn-text" onClick={onExportCsv}>
          <i className="fa-solid fa-file-export"></i> Export CSV
        </button>
      </div>

      {/* 3D Camera Cards List */}
      <div className="camera-list">
        {cameras.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.85rem' }}>
            No camera nodes match current filter criteria.
          </div>
        ) : (
          cameras.map((cam) => {
            let statusClass = 'status-active';
            if (cam.status === 'MAINTENANCE') statusClass = 'status-maintenance';
            if (cam.status === 'OFFLINE') statusClass = 'status-offline';

            const isLiveGovFeed = cam.stream_url && cam.stream_url.includes('live.sentinelgujarat.in');
            const isRtsp = cam.stream_url && cam.stream_url.toLowerCase().startsWith('rtsp://');

            return (
              <div
                key={cam.id}
                className="cam-card-3d"
                onClick={() => onCameraSelect(cam)}
              >
                <div className="cam-card-header">
                  <span className="cam-code">{cam.camera_code}</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={`cam-status ${statusClass}`}>{cam.status}</span>
                    <button
                      className="btn-text"
                      title="Edit Camera Details"
                      style={{ fontSize: '0.85rem', padding: '2px 4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCamera(cam);
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                  </div>
                </div>
                <div className="cam-name">{cam.name}</div>
                <div className="cam-meta">
                  <span><i className="fa-solid fa-building-flag"></i> {cam.department_name || cam.department_id}</span>
                  <span><i className="fa-solid fa-location-dot"></i> {cam.district}</span>
                  <span><i className="fa-solid fa-server"></i> {cam.vms_vendor || 'Hikvision'}</span>
                  {isLiveGovFeed && (
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 800 }}>
                      <i className="fa-solid fa-circle-play"></i> LIVE STREAM
                    </span>
                  )}
                  {isRtsp && (
                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                      <i className="fa-solid fa-network-wired"></i> RTSP FEED
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
