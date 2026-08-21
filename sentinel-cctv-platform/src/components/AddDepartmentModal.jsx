import React, { useState, useEffect } from "react";
import { Building2, X, Check, Shield, Palette, Phone, Mail, User, Tag, Layers } from "lucide-react";

export const AddDepartmentModal = ({ isOpen, onClose, onSaveSuccess, addToast, editingDept = null }) => {
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "Public Domain Infrastructure",
    nodal_officer: "",
    contact_email: "",
    contact_phone: "",
    status: "ACTIVE",
    color: "#22d3ee",
    description: ""
  });

  useEffect(() => {
    if (editingDept) {
      setForm({
        code: editingDept.code || "",
        name: editingDept.name || "",
        category: editingDept.category || "Public Domain Infrastructure",
        nodal_officer: editingDept.nodal_officer || "",
        contact_email: editingDept.contact_email || "",
        contact_phone: editingDept.contact_phone || "",
        status: editingDept.status || "ACTIVE",
        color: editingDept.color || "#22d3ee",
        description: editingDept.description || ""
      });
    } else {
      setForm({
        code: "",
        name: "",
        category: "Public Domain Infrastructure",
        nodal_officer: "",
        contact_email: "",
        contact_phone: "",
        status: "ACTIVE",
        color: "#22d3ee",
        description: ""
      });
    }
  }, [editingDept, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || (!editingDept && !form.code)) {
      addToast("Department Code and Department Name are required.", "error", "Validation Error");
      return;
    }

    try {
      const url = editingDept ? `/api/v1/departments/${editingDept.code}` : "/api/v1/departments";
      const method = editingDept ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (data.success) {
        addToast(
          editingDept ? "Department successfully updated!" : "New Department successfully registered in Statewide Directory!",
          "success",
          editingDept ? "Department Updated" : "Department Registered"
        );
        onSaveSuccess();
        onClose();
      } else {
        addToast(data.error ? data.error.message : "Operation failed", "error", "Error");
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
            <Building2 size={16} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            {editingDept ? `Edit Department — ${editingDept.code}` : "Register New Department"}
          </h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Department Code / Key *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingDept}
                  placeholder="e.g. FOREST, HEALTH, GIDC"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)" }}
                />
                <small style={{ color: "var(--text-dim)", fontSize: "10.5px" }}>Unique identifier across 26 departments</small>
              </div>

              <div className="form-field">
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE / Live Surveillance</option>
                  <option value="ONBOARDING">ONBOARDING / Phase 1 Testing</option>
                  <option value="PENDING_INTEGRATION">PENDING_INTEGRATION</option>
                </select>
              </div>

              <div className="form-field span-2">
                <label>Department Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Forests & Environment Department / Sanctuaries"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Category / Functional Sector</label>
                <input
                  type="text"
                  placeholder="e.g. Wildlife, Public Health, Smart City"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Theme Badge Color</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    style={{ width: "38px", height: "36px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder="#22d3ee"
                    style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Nodal CCTV Officer</label>
                <input
                  type="text"
                  placeholder="e.g. Joint Director (Tech / CCTV Ops)"
                  value={form.nodal_officer}
                  onChange={(e) => setForm({ ...form, nodal_officer: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Nodal Contact Email</label>
                <input
                  type="email"
                  placeholder="e.g. cctv.nodal@gujarat.gov.in"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Contact Helpline / Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +91 79 2325 0000"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>

              <div className="form-field full">
                <label>Mandate & Deployment Scope Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe camera types, locations, and purpose of surveillance under this department..."
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
              <button type="submit" className="btn btn-primary">
                <Check size={14} strokeWidth={2.4} /> {editingDept ? "Save Changes" : "Register Department"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
