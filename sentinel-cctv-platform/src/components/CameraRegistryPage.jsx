import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Play,
  SquarePen,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';

export const CameraRegistryPage = ({
  cameras,
  filters,
  onFilterChange,
  onCameraSelect,
  onEditCamera,
  onExportCsv,
  onAddCamera
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
    <div className="table-view" style={{ display: 'block' }}>
      {/* Page Header & Actions */}
      <div className="table-toolbar">
        <div>
          <h2>Camera Registry</h2>
          <div className="sub">Complete statewide inventory — search, sort and manage every registered device.</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn" onClick={onExportCsv} title="Export CSV, JSON, GeoJSON Reports">
            <FileSpreadsheet size={15} strokeWidth={2.2} /> Export Report
          </button>
          <button className="btn btn-primary" onClick={onAddCamera} title="Onboard New Camera Node">
            <Plus size={15} strokeWidth={2.4} /> Add Camera
          </button>
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="floating filter-bar" style={{ position: 'static', transform: 'none', minWidth: '100%', marginBottom: '18px' }}>
        <div className="search-box">
          <Search size={15} strokeWidth={2.2} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search ID, Location, District, VMS..."
            value={filters.search}
            onChange={(e) => {
              onFilterChange('search', e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          className="filter-select"
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
          className="filter-select"
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
          className="filter-select"
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

        {/* Per Page Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Per Page:</span>
          <select
            className="filter-select"
            style={{ minWidth: '70px' }}
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Camera</th>
              <th>Department</th>
              <th>District</th>
              <th>Type</th>
              <th>GPS Coordinates</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCameras.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
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

                          <button
                            title="Edit Details"
                            onClick={() => onEditCamera(cam)}
                          >
                            <SquarePen size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Table Sub-Row Details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: '16px 20px', background: 'var(--input-bg)' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px'
                          }}>
                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Ownership Type</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.ownership_type || 'GOVERNMENT'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>VMS Vendor Platform</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.vms_vendor || 'Hikvision Platform'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Taluka / Area</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {cam.taluka || 'Central Zone'}
                              </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1', background: 'var(--panel-bg-solid)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Stream Endpoint URL</div>
                              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: '2px', wordBreak: 'break-all' }}>
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
          background: 'var(--panel-bg)',
          borderRadius: '12px',
          border: '1px solid var(--panel-border)',
          marginTop: '16px'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Showing records <b>{startIndex + 1}</b> to <b>{Math.min(startIndex + itemsPerPage, totalItems)}</b> of <b>{totalItems}</b>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-sm"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft size={14} strokeWidth={2} /> Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`btn btn-sm ${currentPage === page ? 'btn-primary' : ''}`}
                style={{ minWidth: '32px' }}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}

            <button
              className="btn btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
