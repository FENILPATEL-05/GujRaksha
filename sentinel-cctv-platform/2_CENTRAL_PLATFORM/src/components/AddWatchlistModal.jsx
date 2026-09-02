import React, { useState } from "react";
import { ShieldAlert, X, Check, Car, AlertTriangle } from "lucide-react";

export const AddWatchlistModal = ({ isOpen, onClose, onSaveSuccess, addToast }) => {
  const [form, setForm] = useState({
    vehicle_plate: "",
    category: "STOLEN_VEHICLE",
    fir_number: "",
    police_station: "",
    owner_name: "",
    priority: "CRITICAL",
    description: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_plate) {
      addToast("Vehicle Plate Number is mandatory.", "error", "Validation Error");
      return;
    }

    try {
      const res = await fetch("/api/v1/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        addToast(`Vehicle '${form.vehicle_plate.toUpperCase()}' added to police watchlist!`, "success", "Watchlist Target Registered");
        window.dispatchEvent(new CustomEvent("watchlist_updated", { detail: data.data }));
        if (onSaveSuccess) onSaveSuccess(data.data);
        onClose();
        setForm({
          vehicle_plate: "",
          category: "STOLEN_VEHICLE",
          fir_number: "",
          police_station: "",
          owner_name: "",
          priority: "CRITICAL",
          description: ""
        });
      } else {
        addToast(data.error ? data.error.message : "Failed to add target to watchlist", "error", "Error");
      }
    } catch (err) {
      addToast(err.message, "error", "Network Error");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-md">
        <div className="modal-head">
          <h3>
            <ShieldAlert size={16} strokeWidth={2.2} style={{ color: "var(--danger)" }} />
            Add Target Vehicle to Police Watchlist
          </h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Vehicle Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter vehicle plate number"
                  value={form.vehicle_plate}
                  onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })}
                  style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "1px" }}
                />
              </div>

              <div className="form-field">
                <label>Watchlist Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="STOLEN_VEHICLE">Stolen Vehicle (FIR Registered)</option>
                  <option value="WANTED_SUSPECT">Wanted Suspect / Criminal Record</option>
                  <option value="MISSING_PERSON">Missing Person Alert</option>
                  <option value="OVERLOAD_VIOLATION">RTO Overload / Toll Violator</option>
                  <option value="BLACKLISTED">Blacklisted Commercial Vehicle</option>
                  <option value="TRAFFIC_ANOMALY">High-Speed / Traffic Anomaly</option>
                </select>
              </div>

              <div className="form-field">
                <label>Alert Priority Level</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="CRITICAL">CRITICAL (Immediate Intercept)</option>
                  <option value="HIGH">HIGH (Command Room Alert)</option>
                  <option value="MEDIUM">MEDIUM (Telemetry Log)</option>
                </select>
              </div>


              <div className="form-field">
                <label>FIR / Challan Reference #</label>
                <input
                  type="text"
                  placeholder="Enter FIR or challan reference number"
                  value={form.fir_number}
                  onChange={(e) => setForm({ ...form, fir_number: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Jurisdiction Police Station</label>
                <input
                  type="text"
                  placeholder="Enter jurisdiction police station"
                  value={form.police_station}
                  onChange={(e) => setForm({ ...form, police_station: e.target.value })}
                />
              </div>

              <div className="form-field full">
                <label>Incident Details & Investigation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter incident details and investigation notes"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "var(--input-bg)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    fontSize: "12.5px"
                  }}
                />

              </div>
            </div>

            <div className="modal-foot" style={{ padding: "12px 0 0 0", marginTop: "12px" }}>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ background: "var(--danger)" }}>
                <Check size={14} strokeWidth={2.4} /> Add Target to Watchlist
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
