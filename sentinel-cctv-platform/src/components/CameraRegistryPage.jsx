import React, { useState } from 'react';

export const CameraRegistryPage = ({
  cameras,
  filters,
  onFilterChange,
  onCameraSelect,
  onEditCamera,
  onExportCsv
}) => {
  const [expandedCameraId, setExpandedCameraId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  return (
    <div style={{
      height: 'calc(100vh - 60px)',
      overflowY: 'auto',
      padding: '24px',
      background: 'var(--bg-main)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Page Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>
            <i className="fa-solid fa-table" style={{ color: 'var(--accent-gold)', marginRight: '10px' }}></i>
            Statewide CCTV Asset Registry Table
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            High-density tabular inventory of Gujarat Police & Department camera nodes.
          </div>
        </div>

        <button className="btn-clean btn-clean-gold" onClick={onExportCsv}>
          <i className="fa-solid fa-file-export"></i> Export Report Options
        </button>
      </div>

      {/* Search & Filter Controls Bar */}
      <div style={{
        background: 'var(--bg-panel)',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-card)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              className="filter-input-clean"
              style={{ width: '100%', paddingLeft: '36px' }}
              placeholder="Search ID, Location, District, VMS..."
              value={filters.search}
              onChange={(e) => {
                onFilterChange('search', e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <select
            className="filter-select-clean"
            value={filters.department}
            onChange={(e) => {
              onFilterChange('department', e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Departments (26)</option>
            <option value="HOME">Home Dept / Gujarat Police</option>
            <option value="TRANSPORT">Transport Dept / RTO Gujarat</option>
            <option value="CIVIL_SUPPLIES">Food & Civil Supplies</option>
            <option value="PORTS">Gujarat Maritime Board / Ports</option>
            <option value="PRIVATE_FEED">Private Commercial Feeder</option>
          </select>

          <select
            className="filter-select-clean"
            value={filters.district}
            onChange={(e) => {
              onFilterChange('district', e.target.value);
              setCurrentPage(1);
            }}
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

        {/* Per Page Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
          <span>Per Page:</span>
          <select
            className="filter-select-clean"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Clean High-Density Data Table */}
      <div style={{
        background: 'var(--bg-panel)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        flex: 1
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', color: 'var(--accent-gold)', fontWeight: 800 }}>
              <th style={{ padding: '12px 16px' }}>Asset Code</th>
              <th style={{ padding: '12px 16px' }}>Camera Name / Location</th>
              <th style={{ padding: '12px 16px' }}>Department</th>
              <th style={{ padding: '12px 16px' }}>District</th>
              <th style={{ padding: '12px 16px' }}>Type</th>
              <th style={{ padding: '12px 16px' }}>GPS Coordinates</th>
              <th style={{ padding: '12px 16px' }}>SLA Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCameras.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: '2rem', marginBottom: '10px', color: 'var(--accent-gold)' }}></i>
                  <div>No camera assets match the search criteria.</div>
                </td>
              </tr>
            ) : (
              currentCameras.map(cam => {
                const isExpanded = expandedCameraId === cam.id;
                let statusClass = 'status-active';
                if (cam.status === 'MAINTENANCE') statusClass = 'status-maintenance';
                if (cam.status === 'OFFLINE') statusClass = 'status-offline';

                const isLive = cam.stream_url && cam.stream_url.includes('live.sentinelgujarat.in');

                return (
                  <React.Fragment key={cam.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isExpanded ? 'var(--bg-card)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleExpand(cam.id)}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--accent-gold)' }}>
                        {cam.camera_code}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {cam.name}
                        {isLive && (
                          <span style={{ color: 'var(--accent-gold)', fontSize: '0.68rem', fontWeight: 800, marginLeft: '8px' }}>
                            LIVE
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-sub)' }}>
                        {cam.department_name || cam.department_id}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-sub)' }}>
                        {cam.district}
                      </td>

                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {cam.camera_type || 'ANPR_SPECIAL'}
                      </td>

                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                        {cam.latitude}, {cam.longitude}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span className={`cam-status ${statusClass}`}>{cam.status}</span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-clean btn-clean-outline"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Expand Details"
                            onClick={() => toggleExpand(cam.id)}
                          >
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </button>

                          <button
                            className="btn-clean btn-clean-outline"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Watch Stream"
                            onClick={() => onCameraSelect(cam)}
                          >
                            <i className="fa-solid fa-play"></i>
                          </button>

                          <button
                            className="btn-clean btn-clean-gold"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Edit Details"
                            onClick={() => onEditCamera(cam)}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Table Sub-Row Details */}
                    {isExpanded && (
                      <tr style={{ background: 'var(--bg-card)', borderBottom: '2px solid var(--accent-gold)' }}>
                        <td colSpan={8} style={{ padding: '16px 20px' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px'
                          }}>
                            <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Ownership Type</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                                {cam.ownership_type || 'GOVERNMENT'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>VMS Vendor Platform</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                                {cam.vms_vendor || 'Hikvision Platform'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Taluka / Area</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                                {cam.taluka || 'Central Zone'}
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Stream Endpoint URL</div>
                              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#38bdf8', marginTop: '2px', wordBreak: 'break-all' }}>
                                {cam.stream_url || 'N/A Direct Protocol'}
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

      {/* Pagination Controls Footer */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          background: 'var(--bg-panel)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
            Showing records <b>{startIndex + 1}</b> to <b>{Math.min(startIndex + itemsPerPage, totalItems)}</b> of <b>{totalItems}</b>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn-clean btn-clean-outline"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <i className="fa-solid fa-chevron-left"></i> Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`btn-clean ${currentPage === page ? 'btn-clean-gold' : 'btn-clean-outline'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}

            <button
              className="btn-clean btn-clean-outline"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
