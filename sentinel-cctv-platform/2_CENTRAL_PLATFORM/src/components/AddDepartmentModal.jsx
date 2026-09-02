import React, { useState, useEffect } from "react";
import { Building2, X, Check, RefreshCw } from "lucide-react";

export const AddDepartmentModal = ({ isOpen, onClose, onSaveSuccess, addToast, editingDept = null }) => {
  const [form, setForm] = useState({
    name: "",
    nodal_officer: "",
    contact_email: "",
    contact_phone: "",
    color: "#22d3ee"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingDept) {
      setForm({
        name: editingDept.name || "",
        nodal_officer: editingDept.nodal_officer || "",
        contact_email: editingDept.contact_email || "",
        contact_phone: editingDept.contact_phone || "",
        color: editingDept.color || "#22d3ee"
      });
    } else {
      setForm({
        name: "",
        nodal_officer: "",
        contact_email: "",
        contact_phone: "",
        color: "#22d3ee"
      });
    }
  }, [editingDept, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Department Name is required.", "error", "Validation Error");
      return;
    }

    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal-md" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Fixed Modal Header */}
        <div className="modal-head" style={{ flexShrink: 0 }}>
          <h3>
            <Building2 size={16} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
            {editingDept ? `Edit Department — ${editingDept.name}` : "Register New Department"}
          </h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Scrollable Modal Body */}
          <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "20px 24px" }}>
            <div className="form-grid">
              {/* Row 1: Department Full Name (Span 2) */}
              <div className="form-field span-2">
                <label>Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter department name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Row 2: Nodal Officer & Color */}
              <div className="form-field">
                <label>Nodal CCTV Officer</label>
                <input
                  type="text"
                  placeholder="Enter nodal officer name"
                  value={form.nodal_officer}
                  onChange={(e) => setForm({ ...form, nodal_officer: e.target.value })}
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
                    placeholder="Enter color hex code"
                    style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                  />
                </div>
              </div>

              {/* Row 3: Contact Email & Phone */}
              <div className="form-field">
                <label>Nodal Contact Email</label>
                <input
                  type="email"
                  placeholder="Enter nodal contact email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Contact Helpline / Phone</label>
                <input
                  type="text"
                  placeholder="Enter contact helpline / phone number"
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>

            </div>
          </div>

          {/* Fixed Modal Footer */}
          <div
            className="modal-foot"
            style={{
              flexShrink: 0,
              padding: "14px 24px",
              borderTop: "1px solid var(--panel-border)",
              background: "var(--panel-bg-solid)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ gap: "6px" }}>
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin-animation" /> Saving...
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.4} /> {editingDept ? "Save Changes" : "Register Department"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

