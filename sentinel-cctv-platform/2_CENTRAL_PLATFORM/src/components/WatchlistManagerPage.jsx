import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  Car,
  AlertTriangle,
  LocateFixed,
  FileSpreadsheet,
  CheckCircle2,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Edit2,
  Check,
  RefreshCw
} from "lucide-react";

import { Pagination } from "./Pagination";
import { ConfirmWarningModal } from "./ConfirmWarningModal";

export const WatchlistManagerPage = ({
  onOpenAddWatchlist,
  onTrackVehicleOnMap,
  onWatchlistChange,
  addToast
}) => {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const [editingItem, setEditingItem] = useState(null);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/watchlist");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setWatchlist(json.data);
        if (onWatchlistChange) onWatchlistChange(json.data.length);
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();

    const handleGlobalUpdate = () => {
      fetchWatchlist();
    };

    window.addEventListener("watchlist_updated", handleGlobalUpdate);

    // Connect to live SSE for instant real-time watchlist sync across tabs/browsers
    let eventSource;
    try {
      eventSource = new EventSource("/api/v1/anpr/alerts/live");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "WATCHLIST_CHANGED") {
            fetchWatchlist();
          }
        } catch (e) {}
      };
    } catch (err) {
      console.error("SSE Error in Watchlist:", err);
    }

    return () => {
      window.removeEventListener("watchlist_updated", handleGlobalUpdate);
      if (eventSource) eventSource.close();
    };
  }, []);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    submessage: '',
    confirmText: 'Remove Target',
    type: 'danger',
    onConfirm: null,
    isLoading: false
  });

  const handleDelete = (item) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Target from Watchlist?',
      message: `Are you sure you want to remove vehicle "${item.vehicle_plate}" from active police surveillance?`,
      submessage: `Reason: ${item.reason || 'Flagged Target'} | District: ${item.district || 'Statewide'}`,
      confirmText: 'Remove Target',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/v1/watchlist/${item.id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            addToast?.(`Target '${item.vehicle_plate}' removed from watchlist.`, "success", "Watchlist Updated");
            setWatchlist(prev => prev.filter(w => w.id !== item.id));
            window.dispatchEvent(new CustomEvent("watchlist_updated"));
            if (onWatchlistChange) onWatchlistChange(watchlist.length - 1);
          } else {
            addToast?.(data.error ? data.error.message : "Failed to delete item", "error", "Error");
          }
        } catch (err) {
          addToast?.(err.message, "error", "Network Error");
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      }
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const res = await fetch(`/api/v1/watchlist/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem)
      });
      const data = await res.json();
      if (data.success) {
        addToast?.(`Target '${editingItem.vehicle_plate}' updated successfully!`, "success", "Watchlist Updated");
        setEditingItem(null);
        fetchWatchlist();
        window.dispatchEvent(new CustomEvent("watchlist_updated"));
      } else {
        addToast?.(data.error ? data.error.message : "Failed to update item", "error", "Error");
      }
    } catch (err) {
      addToast?.(err.message, "error", "Network Error");
    }
  };

  const filteredWatchlist = watchlist.filter(item => {
    const q = search.toLowerCase().replace(/[^a-z0-9]/g, "");
    const plateNorm = (item.vehicle_plate || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const firNorm = (item.fir_number || "").toLowerCase();
    const matchSearch = !search || plateNorm.includes(q) || firNorm.includes(search.toLowerCase());

    const matchCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchPriority = priorityFilter === "ALL" || item.priority === priorityFilter;

    return matchSearch && matchCategory && matchPriority;
  });

  let activeFilterCount = 0;
  if (categoryFilter !== "ALL") activeFilterCount++;
  if (priorityFilter !== "ALL") activeFilterCount++;

  const handleResetFilters = () => {
    setCategoryFilter("ALL");
    setPriorityFilter("ALL");
    setCurrentPage(1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div className="table-unified-toolbar" style={{ marginBottom: "14px", flexShrink: 0 }}>
        <div className="toolbar-filters-group" style={{ flex: 1, minWidth: "auto" }}>
          <button className="btn btn-primary" onClick={onOpenAddWatchlist} style={{ background: "var(--danger)", padding: "7px 14px", gap: "6px", flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.4} /> Add Target Vehicle
          </button>
        </div>

        <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Compact Search Box on Right */}
          <div className="search-box" style={{ width: "200px", height: "36px", flexShrink: 0 }}>
            <Search size={14} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search plate, FIR..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              style={{ fontSize: "12px" }}
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

          {/* Filter Popover Button (Right-Anchored) */}
          <div style={{ position: "relative", zIndex: 1000 }}>
            <button
              className="btn"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                height: "36px",
                padding: "0 12px",
                gap: "6px",
                fontSize: "12px",
                background: activeFilterCount > 0 ? "rgba(34, 211, 238, 0.15)" : "var(--input-bg)",
                borderColor: activeFilterCount > 0 ? "var(--accent)" : "var(--panel-border)",
                color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-primary)"
              }}
              title="Open Watchlist Filters"
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
                <div className="filter-popover-dropdown" style={{ right: 0, left: "auto", minWidth: "260px" }}>
                  <div className="filter-popover-header">
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <SlidersHorizontal size={12} style={{ color: "var(--accent)" }} /> Filter Options
                    </div>
                    {activeFilterCount > 0 && (
                      <button className="filter-popover-reset" onClick={handleResetFilters}>
                        Reset All
                      </button>
                    )}
                  </div>

                  <div className="filter-popover-field">
                    <label className="filter-popover-label">Category</label>
                    <select
                      className="filter-popover-select"
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="ALL">All Categories ({watchlist.length})</option>
                      <option value="STOLEN_VEHICLE">Stolen Vehicles (FIR)</option>
                      <option value="WANTED_SUSPECT">Wanted Suspects</option>
                      <option value="MISSING_PERSON">Missing Person</option>
                      <option value="OVERLOAD_VIOLATION">RTO Overload Violators</option>
                      <option value="BLACKLISTED">Blacklisted Commercial</option>
                    </select>
                  </div>

                  <div className="filter-popover-field">
                    <label className="filter-popover-label">Priority Level</label>
                    <select
                      className="filter-popover-select"
                      value={priorityFilter}
                      onChange={(e) => {
                        setPriorityFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
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

          <button className="btn" onClick={fetchWatchlist} style={{ height: "36px", padding: "0 12px", gap: "6px" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>


      {/* Watchlist Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Target Vehicle</th>
              <th>Category</th>
              <th>FIR / Case Ref</th>
              <th>Police Station</th>
              <th>Priority</th>
              <th>Date Added</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWatchlist.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                  <FolderOpen size={38} strokeWidth={1.5} style={{ color: "var(--danger)", marginBottom: "8px" }} />
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>No Target Vehicles Found in Watchlist</div>
                  <div style={{ fontSize: "12px", marginTop: "4px", color: "var(--text-dim)" }}>
                    Add target suspect license plates to trigger statewide instant police ANPR alerts.
                  </div>
                </td>
              </tr>
            ) : (
              filteredWatchlist
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 800,
                          fontSize: "13px",
                          letterSpacing: "0.5px",
                          color: "var(--text-primary)",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          padding: "3px 8px",
                          borderRadius: "4px"
                        }}>
                          {item.vehicle_plate}
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                        Owner: {item.owner_name || "Under Investigation"}
                      </div>

                      <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "9.5px", padding: "1px 5px", borderRadius: "3px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", fontWeight: 600 }}>
                          VAHAN 4.0
                        </span>
                        <span style={{ fontSize: "9.5px", padding: "1px 5px", borderRadius: "3px", background: "rgba(239, 68, 68, 0.12)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.25)", fontWeight: 600 }}>
                          eGujCop
                        </span>
                        {item.priority === "CRITICAL" && (
                          <span style={{ fontSize: "9.5px", padding: "1px 5px", borderRadius: "3px", background: "rgba(34, 211, 238, 0.12)", color: "var(--accent)", border: "1px solid rgba(34, 211, 238, 0.25)", fontWeight: 600 }}>
                            NAFIS Flagged
                          </span>
                        )}
                      </div>
                    </td>


                    <td>
                      <span className="badge" style={{
                        background: item.category === "STOLEN_VEHICLE" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: item.category === "STOLEN_VEHICLE" ? "#ef4444" : "#f59e0b",
                        fontWeight: 700,
                        fontSize: "11px"
                      }}>
                        {item.category?.replace(/_/g, " ") || "FLAGGED"}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary)" }}>
                        {item.fir_number || "Active FIR"}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {item.police_station || "State Police Surveillance Cell"}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${item.priority === "CRITICAL" ? "badge-danger" : item.priority === "HIGH" ? "badge-warning" : "badge-info"}`} style={{ fontSize: "10.5px" }}>
                        {item.priority || "HIGH"}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {new Date(item.created_at || Date.now()).toLocaleDateString()}
                      </div>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-xs"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          onClick={() => setEditingItem({ ...item })}
                          title="Edit Target Details"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          className="btn btn-xs btn-danger"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          onClick={() => handleDelete(item)}
                          title="Remove from Watchlist"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* Enhanced Responsive Pagination Footer */}
      {filteredWatchlist.length > 0 && (
        <div className="table-pagination-footer" style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--panel-border)",
          marginTop: "10px",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--panel-bg)",
          borderRadius: "0 0 8px 8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
              Showing <strong style={{ color: "var(--text-primary)" }}>{(currentPage - 1) * itemsPerPage + 1}</strong>–<strong style={{ color: "var(--text-primary)" }}>{Math.min(currentPage * itemsPerPage, filteredWatchlist.length)}</strong> of <strong style={{ color: "var(--danger)" }}>{filteredWatchlist.length}</strong> target records
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
              <span>Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "6px",
                  padding: "3px 8px",
                  fontSize: "12px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(filteredWatchlist.length / itemsPerPage))}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}


      {/* Edit Watchlist Target Modal */}
      {editingItem && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            className="modal modal-md"
            style={{ backgroundColor: "#0f172a", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", width: "100%", maxWidth: "540px", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", color: "#fff" }}>
                <ShieldAlert size={16} strokeWidth={2.2} style={{ color: "var(--danger)" }} />
                Edit Watchlist Target: <span style={{ color: "var(--danger)", fontFamily: "var(--font-mono)" }}>{editingItem.vehicle_plate}</span>
              </h3>
              <button onClick={() => setEditingItem(null)} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Vehicle Number Plate</label>
                  <input
                    type="text"
                    className="input"
                    value={editingItem.vehicle_plate}
                    onChange={(e) => setEditingItem({ ...editingItem, vehicle_plate: e.target.value.toUpperCase() })}
                    style={{ width: "100%", fontFamily: "var(--font-mono)", fontWeight: 700 }}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Category</label>
                    <select
                      className="input"
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      style={{ width: "100%" }}
                    >
                      <option value="STOLEN_VEHICLE">Stolen Vehicle (FIR)</option>
                      <option value="WANTED_SUSPECT">Wanted Suspect</option>
                      <option value="MISSING_PERSON">Missing Person</option>
                      <option value="OVERLOAD_VIOLATION">RTO Overload Violators</option>
                      <option value="BLACKLISTED">Blacklisted Commercial</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Priority Level</label>
                    <select
                      className="input"
                      value={editingItem.priority}
                      onChange={(e) => setEditingItem({ ...editingItem, priority: e.target.value })}
                      style={{ width: "100%" }}
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>FIR / Case Number</label>
                    <input
                      type="text"
                      className="input"
                      value={editingItem.fir_number || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, fir_number: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Police Station</label>
                    <input
                      type="text"
                      className="input"
                      value={editingItem.police_station || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, police_station: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Description / Intel Notes</label>
                  <textarea
                    className="input"
                    value={editingItem.description || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    rows={2}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: "var(--danger)" }}>
                  <Check size={14} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
