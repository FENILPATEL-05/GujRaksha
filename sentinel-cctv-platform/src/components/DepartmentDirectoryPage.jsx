import React, { useState } from "react";
import {
  Building2,
  Search,
  Plus,
  Video,
  SquarePen,
  Trash2,
  Users,
  Mail,
  Phone,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  X
} from "lucide-react";
import { Pagination } from "./Pagination";

export const DepartmentDirectoryPage = ({
  departments = [],
  onRefresh,
  onOpenAddDept,
  onEditDept,
  onViewCamerasForDept,
  addToast
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Filtering
  const filteredDepartments = departments.filter(d => {
    const q = search.toLowerCase();
    const matchQuery =
      !search ||
      (d.code && d.code.toLowerCase().includes(q)) ||
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.category && d.category.toLowerCase().includes(q)) ||
      (d.nodal_officer && d.nodal_officer.toLowerCase().includes(q));

    const matchStatus = statusFilter === "ALL" || (d.status || "").toUpperCase() === statusFilter;
    return matchQuery && matchStatus;
  });

  // Aggregated Stats
  const totalDepts = departments.length;
  const activeDepts = departments.filter(d => d.status === "ACTIVE").length;
  const totalCamerasAcrossDepts = departments.reduce((acc, d) => acc + (d.totalCameras || 0), 0);

  // Pagination
  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentDepartments = filteredDepartments.slice(startIndex, startIndex + itemsPerPage);

  const handleDeleteDept = async (dept) => {
    if (dept.totalCameras > 0) {
      addToast(
        `Cannot delete '${dept.code}' because ${dept.totalCameras} camera assets are currently linked to it.`,
        "error",
        "Delete Blocked"
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to remove '${dept.name}' from the statewide department registry?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/departments/${dept.code}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        addToast(`Department '${dept.code}' removed successfully.`, "success", "Deleted");
        onRefresh();
      } else {
        addToast(data.error ? data.error.message : "Failed to delete department", "error", "Error");
      }
    } catch (err) {
      addToast(err.message, "error", "Network Error");
    }
  };

  const activeFilterCount = statusFilter !== "ALL" ? 1 : 0;

  return (
    <div className="table-view">
      {/* Unified Single-Row Header, Filters & Action Toolbar */}
      <div className="table-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        {/* Left: Title */}
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, whiteSpace: "nowrap" }}>
          <Building2 size={20} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
          Departments
        </h2>

        {/* Center: Search Box & Single Filter Popover Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 300px", maxWidth: "620px" }}>
          <div className="search-box" style={{ flex: 1 }}>
            <Search size={14} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search Code, Name, Ministry, Nodal Officer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search && (
              <X
                size={13}
                style={{ cursor: "pointer", color: "var(--text-dim)" }}
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          {/* Single Filter Popover Button */}
          <div style={{ position: "relative", zIndex: 1000 }}>
            <button
              className="btn"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                height: "36px",
                padding: "0 13px",
                gap: "6px",
                fontSize: "12px",
                background: activeFilterCount > 0 ? "rgba(34, 211, 238, 0.15)" : "rgba(30, 41, 59, 0.55)",
                borderColor: activeFilterCount > 0 ? "var(--accent)" : "rgba(255, 255, 255, 0.1)",
                color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-primary)"
              }}
              title="Open Department Filters"
            >
              <SlidersHorizontal size={13} strokeWidth={2.2} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: "var(--accent)",
                  color: "#000",
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "1px 5px",
                  borderRadius: "10px"
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilterMenu && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 999 }}
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="filter-popover-dropdown">
                  <div className="filter-popover-header">
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <SlidersHorizontal size={12} style={{ color: "var(--accent)" }} /> Filter Options
                    </div>
                    {activeFilterCount > 0 && (
                      <button
                        className="filter-popover-reset"
                        onClick={() => {
                          setStatusFilter("ALL");
                          setCurrentPage(1);
                        }}
                      >
                        Reset All
                      </button>
                    )}
                  </div>

                  <div className="filter-popover-field">
                    <label className="filter-popover-label">Department Status</label>
                    <select
                      className="filter-popover-select"
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="ALL">All Statuses ({totalDepts})</option>
                      <option value="ACTIVE">ACTIVE ({activeDepts})</option>
                      <option value="ONBOARDING">ONBOARDING ({totalDepts - activeDepts})</option>
                    </select>
                  </div>

                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowFilterMenu(false)}
                    style={{ marginTop: "4px", width: "100%", justifyContent: "center" }}
                  >
                    Apply Filters
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Refresh & Add Department Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn" onClick={onRefresh} title="Reload Department List" style={{ padding: "7px 12px", gap: "5px" }}>
            <RefreshCw size={14} /> Refresh
          </button>

          <button className="btn btn-primary" onClick={onOpenAddDept} title="Register New Department" style={{ padding: "7px 14px", gap: "6px" }}>
            <Plus size={15} strokeWidth={2.4} /> Add Department
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Department / Entity</th>
              <th>Category</th>
              <th>Nodal In-Charge & Contact</th>
              <th style={{ textAlign: "center" }}>Linked Cameras</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentDepartments.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-dim)" }}>
                  <FolderOpen size={36} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                  <div>No departments match the search criteria.</div>
                </td>
              </tr>
            ) : (
              currentDepartments.map((dept) => {
                const isActive = dept.status === "ACTIVE";
                const badgeColor = dept.color || "#22d3ee";

                return (
                  <tr key={dept.code}>
                    {/* 1. Department Name & Code */}
                    <td>
                      <div className="cell-name" style={{ fontWeight: 700 }}>
                        {dept.name}
                      </div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: `${badgeColor}18`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}35`
                          }}
                        >
                          {dept.code}
                        </span>
                      </div>
                    </td>

                    {/* 2. Category */}
                    <td style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                      {dept.category || "Public Administration"}
                    </td>

                    {/* 3. Nodal Officer & Contact */}
                    <td>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "5px" }}>
                        <Users size={12} strokeWidth={2} style={{ color: "var(--accent)" }} />
                        {dept.nodal_officer || "Nodal In-Charge"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                        {dept.contact_email || "nodal@gujarat.gov.in"}
                        {dept.contact_phone && ` · ${dept.contact_phone}`}
                      </div>
                    </td>

                    {/* 4. Linked Cameras Count */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => onViewCamerasForDept(dept.code)}
                        title={`View ${dept.totalCameras || 0} cameras in Registry`}
                        style={{
                          fontSize: "11.5px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          padding: "2px 8px",
                          color: (dept.totalCameras || 0) > 0 ? "var(--accent)" : "var(--text-dim)"
                        }}
                      >
                        <Video size={12} strokeWidth={2} /> {dept.totalCameras || 0}
                      </button>
                    </td>

                    {/* 5. Status Badge */}
                    <td>
                      <span className={`badge ${isActive ? "active" : "maintenance"}`}>
                        {dept.status || "ACTIVE"}
                      </span>
                    </td>

                    {/* 6. Action Buttons */}
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
      {totalPages > 1 && (
        <div className="table-pagination-footer" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
            Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredDepartments.length)} of {filteredDepartments.length} departments
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}
    </div>
  );
};
