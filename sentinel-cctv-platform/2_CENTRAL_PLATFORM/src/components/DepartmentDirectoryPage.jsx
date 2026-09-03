import React, { useState } from "react";
import {
  Building2,
  Search,
  Plus,
  Video,
  SquarePen,
  Trash2,
  Users,
  FolderOpen,
  RefreshCw,
  X
} from "lucide-react";
import { Pagination } from "./Pagination";
import { ConfirmWarningModal } from "./ConfirmWarningModal";

export const DepartmentDirectoryPage = ({
  departments = [],
  onRefresh,
  onOpenAddDept,
  onEditDept,
  onViewCamerasForDept,
  onOpenUserMgmt,
  addToast
}) => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);



  // Filtering
  const filteredDepartments = departments.filter((d) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.category && d.category.toLowerCase().includes(q)) ||
      (d.code && d.code.toLowerCase().includes(q)) ||
      (d.nodal_officer && d.nodal_officer.toLowerCase().includes(q)) ||
      (d.contact_email && d.contact_email.toLowerCase().includes(q)) ||
      (d.contact_phone && d.contact_phone.toLowerCase().includes(q))
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentDepartments = filteredDepartments.slice(startIndex, startIndex + itemsPerPage);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    submessage: '',
    confirmText: 'Remove',
    type: 'danger',
    onConfirm: null,
    isLoading: false
  });

  const handleDeleteDept = (dept) => {
    if (dept.totalCameras > 0) {
      addToast(
        `Cannot delete '${dept.name}' because ${dept.totalCameras} camera assets are currently linked to it.`,
        "error",
        "Delete Blocked"
      );
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Department?',
      message: `Are you sure you want to remove "${dept.name}" (${dept.code}) from the statewide registry?`,
      submessage: 'This department profile and key mappings will be deleted.',
      confirmText: 'Remove Department',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/v1/departments/${dept.code}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            addToast(`Department '${dept.name}' removed successfully.`, "success", "Deleted");
            onRefresh();
          } else {
            addToast(data.error ? data.error.message : "Failed to delete department", "error", "Error");
          }
        } catch (err) {
          addToast(err.message, "error", "Network Error");
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  return (
    <div className="table-view">
      {/* Unified Single-Row Header, Compact Search & Action Toolbar */}
      <div className="table-unified-toolbar">
        {/* Left Side: Title & Count Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, whiteSpace: "nowrap" }}>
            Departments
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
            {departments.length} Entities
          </span>
        </div>

        {/* Right Side: Compact Search & Action Buttons */}
        <div className="toolbar-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {/* Compact Search Box */}
          <div className="search-box" style={{ width: '230px', minWidth: '180px', flex: 'none', height: '36px' }}>
            <Search size={13} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search departments..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: '12px' }}
            />
            {search && (
              <X
                size={12}
                style={{ cursor: "pointer", color: "var(--text-dim)" }}
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          <button className="btn btn-primary" onClick={onOpenAddDept} title="Register New Department" style={{ height: "36px", padding: "0 13px", gap: "5px", fontSize: "12px" }}>
            <Plus size={14} strokeWidth={2.4} /> <span>Add Department</span>
          </button>
        </div>
      </div>



      {/* Active Filter Chips Bar */}
      {search && search.trim() && (
        <div className="active-filters-strip">
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Active:
          </span>
          <div className="active-filter-chip">
            <span>Query: "{search}"</span>
            <span className="active-filter-chip-remove" onClick={() => setSearch("")}>
              <X size={11} />
            </span>
          </div>
          <button
            className="filter-popover-reset"
            onClick={() => setSearch("")}
            style={{ marginLeft: 'auto', fontSize: '11px' }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="table-container">

        <table className="data-table">
          <thead>
            <tr>
              <th>Department Name</th>
              <th>Department Key</th>
              <th>Nodal In-Charge & Contact</th>
              <th style={{ textAlign: "center" }}>Linked Cameras</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentDepartments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-dim)" }}>
                  <FolderOpen size={36} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                  <div>No departments match the search criteria.</div>
                </td>
              </tr>
            ) : (
              currentDepartments.map((dept) => {
                const badgeColor = dept.color || "#22d3ee";

                return (
                  <tr key={dept.code}>
                    {/* 1. Department Name */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: badgeColor,
                            boxShadow: `0 0 8px ${badgeColor}60`,
                            flexShrink: 0
                          }}
                        />
                        <div className="cell-name" style={{ fontWeight: 700, fontSize: "13.5px" }}>
                          {dept.name}
                        </div>
                      </div>
                    </td>

                    {/* 2. Department Key */}
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: "rgba(34, 211, 238, 0.12)",
                          color: "var(--accent)",
                          border: "1px solid rgba(34, 211, 238, 0.25)",
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          padding: "2px 8px"
                        }}
                      >
                        {dept.code}
                      </span>
                    </td>

                    {/* 3. Nodal Officer & Contact */}
                    <td>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Users size={12} strokeWidth={2} style={{ color: "var(--accent)" }} />
                        {dept.nodal_officer || "Nodal In-Charge"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                        {dept.contact_email || "nodal@gujarat.gov.in"}
                        {dept.contact_phone && ` · ${dept.contact_phone}`}
                      </div>
                    </td>

                    {/* 3. Linked Cameras Count */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => onViewCamerasForDept(dept.code)}
                        title={`View ${dept.totalCameras || 0} cameras in Registry`}
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          padding: "3px 10px",
                          color: (dept.totalCameras || 0) > 0 ? "var(--accent)" : "var(--text-dim)"
                        }}
                      >
                        <Video size={12} strokeWidth={2} /> {dept.totalCameras || 0}
                      </button>
                    </td>

                    {/* 4. Action Buttons */}
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="View Cameras for Department"
                          onClick={() => onViewCamerasForDept(dept.code)}
                        >
                          <Video size={13} strokeWidth={2} />
                        </button>

                        <button
                          title="Edit Department"
                          onClick={() => onEditDept(dept)}
                        >
                          <SquarePen size={13} strokeWidth={2} />
                        </button>

                        <button
                          title="Delete Department"
                          onClick={() => handleDeleteDept(dept)}
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer" style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Showing records <b>{filteredDepartments.length === 0 ? 0 : startIndex + 1}</b> to <b>{Math.min(startIndex + itemsPerPage, filteredDepartments.length)}</b> of <b>{filteredDepartments.length}</b> departments
          </div>

          <div className="per-page-wrapper" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
            <span>Rows per page:</span>
            <select
              className="filter-select per-page-select"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ height: "30px", padding: "0 8px", fontSize: "12px" }}
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
            onPageChange={(p) => setCurrentPage(p)}
          />
        )}
      </div>

      <ConfirmWarningModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        submessage={confirmDialog.submessage}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        isLoading={confirmDialog.isLoading}
      />
    </div>

  );
};

