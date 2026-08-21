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
  X
} from "lucide-react";

export const WatchlistManagerPage = ({
  onOpenAddWatchlist,
  onTrackVehicleOnMap,
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

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/watchlist");
      const json = await res.json();
      if (json.success) {
        setWatchlist(json.data);
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove '${item.vehicle_plate}' from the police surveillance watchlist?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/watchlist/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        addToast(`Target '${item.vehicle_plate}' removed from watchlist.`, "success", "Watchlist Updated");
        fetchWatchlist();
      } else {
        addToast(data.error ? data.error.message : "Failed to delete item", "error", "Error");
      }
    } catch (err) {
      addToast(err.message, "error", "Network Error");
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
        <div className="toolbar-filters-group" style={{ flex: 1 }}>
          <div className="search-box" style={{ flex: "1 1 260px" }}>
            <Search size={14} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search Target Plate Number, FIR #, Police Station..."
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
                <div className="filter-popover-dropdown">
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
        </div>

        <div className="toolbar-actions-group" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn" onClick={fetchWatchlist} style={{ padding: "7px 12px" }}>
            Refresh
          </button>

          <button className="btn btn-primary" onClick={onOpenAddWatchlist} style={{ background: "var(--danger)", padding: "7px 14px", gap: "6px" }}>
            <Plus size={15} strokeWidth={2.4} /> Add Target Vehicle
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
                  <div>No watchlist targets match the current filters.</div>
                </td>
              </tr>
            ) : (
              filteredWatchlist.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => {
                const isCritical = item.priority === "CRITICAL";

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="vehicle-plate-box" style={{ margin: "2px 0" }}>
                        <span className="plate-flag">IND</span>
                        <span className="plate-number">{item.vehicle_plate}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>{item.vehicle_type}</div>
                    </td>

                    <td>
                      <span className="dept-tag" style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.25)" }}>
                        {item.category.replace("_", " ")}
                      </span>
                    </td>

                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-primary)" }}>
                      {item.fir_number}
                    </td>

                    <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {item.police_station}
                    </td>

                    <td>
                      <span className={`threat-severity-badge ${item.priority.toLowerCase()}`}>
                        {item.priority}
                      </span>
                    </td>

                    <td style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        <button
                          title="Track Vehicle Route on GIS Map"
                          onClick={() => onTrackVehicleOnMap(item.vehicle_plate)}
                          style={{ color: "var(--accent)" }}
                        >
                          <LocateFixed size={14} strokeWidth={2.2} />
                        </button>

                        <button
                          title="Remove from Watchlist"
                          onClick={() => handleDelete(item)}
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={14} strokeWidth={2} />
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
      {Math.ceil(filteredWatchlist.length / itemsPerPage) > 1 && (
        <div className="table-pagination-footer" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", marginTop: "10px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredWatchlist.length)} of {filteredWatchlist.length} targets
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              className="btn btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", padding: "0 8px" }}>
              Page {currentPage} of {Math.ceil(filteredWatchlist.length / itemsPerPage)}
            </span>
            <button
              className="btn btn-sm"
              disabled={currentPage === Math.ceil(filteredWatchlist.length / itemsPerPage)}
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredWatchlist.length / itemsPerPage), p + 1))}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
