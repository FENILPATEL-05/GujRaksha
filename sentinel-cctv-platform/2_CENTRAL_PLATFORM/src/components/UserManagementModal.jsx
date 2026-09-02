import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Crown,
  Eye,
  Search,
  Plus,
  X,
  Building2,
  FolderOpen
} from 'lucide-react';
import { Pagination } from './Pagination';

export const UserManagementPage = ({ departments = [], addToast }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);


  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'DEPT_ADMIN',
    department_id: departments[0]?.code || 'HOME'
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/users');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAddModal = () => {
    setForm({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'DEPT_ADMIN',
      department_id: departments[0]?.code || 'HOME'
    });
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      addToast('Username and Password are required.', 'error', 'Validation Error');
      return;
    }

    const selectedDept = departments.find(d => d.code === form.department_id);
    const department_name = form.role === 'SUPERADMIN' 
      ? 'Statewide Command Center' 
      : (selectedDept?.name || form.department_id);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || form.username.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.trim() || `${form.username.trim().toLowerCase()}@gujraksha.gov.in`,
          password: form.password.trim(),
          role: form.role,
          department_id: form.role === 'SUPERADMIN' ? 'ALL' : form.department_id,
          department_name: department_name
        })
      });

      const data = await res.json();
      if (data.success) {
        addToast(`User '${data.data?.name || form.name}' registered successfully!`, 'success', 'User Registered');
        setIsAddModalOpen(false);
        fetchUsers();
      } else {
        addToast(data.error?.message || 'Failed to create user.', 'error', 'Registration Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.username === 'superadmin' || u.username === 'admin') {
      addToast('Primary Superadmin account cannot be deleted.', 'error', 'Protected Account');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user '${u.name}' (${u.username}) from GujRaksha?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/auth/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast(`User '${u.name}' removed successfully.`, 'success', 'User Deleted');
        fetchUsers();
      } else {
        addToast(data.error?.message || 'Failed to delete user', 'error', 'Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    }
  };

  const renderRoleBadge = (role) => {
    switch (role) {
      case 'SUPERADMIN':
      case 'ADMIN':
        return (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', gap: '4px', padding: '3px 8px' }}>
            <Crown size={11} strokeWidth={2.5} /> SUPERADMIN
          </span>
        );
      case 'DEPT_ADMIN':
        return (
          <span className="badge" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.3)', gap: '4px', padding: '3px 8px' }}>
            <Building2 size={11} strokeWidth={2.5} /> DEPT ADMIN
          </span>
        );
      case 'VIEWER':
      default:
        return (
          <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)', gap: '4px', padding: '3px 8px' }}>
            <Eye size={11} strokeWidth={2.5} /> VIEWER
          </span>
        );
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.department_name && u.department_name.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="table-view">
      {/* Unified Single-Row Header, Compact Search & Action Toolbar */}
      <div className="table-unified-toolbar">
        {/* Left Side: Title & Count Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, whiteSpace: "nowrap" }}>
            Users & Roles
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
            {users.length} Users
          </span>
        </div>

        {/* Right Side: Compact Search & Add User Button (No Refresh Button) */}
        <div className="toolbar-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <div className="search-box" style={{ width: '230px', minWidth: '180px', flex: 'none', height: '36px' }}>
            <Search size={13} strokeWidth={2.2} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search users..."
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

          <button
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            title="Register New Officer Account"
            style={{ height: "36px", padding: "0 13px", gap: "6px", fontSize: "12px" }}
          >
            <Plus size={14} strokeWidth={2.4} /> <span>Add User</span>
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

      {/* Users Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>User & Identity</th>
              <th>Role</th>
              <th>Assigned Department</th>
              <th>Email</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-dim)" }}>
                  <FolderOpen size={36} strokeWidth={1.5} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                  <div>{isLoading ? 'Loading system users...' : 'No users match the search criteria.'}</div>
                </td>
              </tr>
            ) : (
              currentUsers.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--input-bg)', border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>
                        {u.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{renderRoleBadge(u.role)}</td>
                  <td>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {u.department_name || (u.department_id === 'ALL' ? 'Statewide (All 26+ Departments)' : u.department_id)}
                    </div>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                      {u.username !== 'superadmin' && u.username !== 'admin' && (
                        <button
                          title="Delete User"
                          onClick={() => handleDeleteUser(u)}
                          style={{ color: "var(--danger)" }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer" style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--panel-border)", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
            Showing records <b>{filteredUsers.length === 0 ? 0 : startIndex + 1}</b> to <b>{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</b> of <b>{filteredUsers.length}</b> users
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


      {/* Add User Modal Dialog */}
      {isAddModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal modal-md" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Fixed Modal Header */}
            <div className="modal-head" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={17} strokeWidth={2.2} style={{ color: "var(--accent)" }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Register Department Access Account</h3>
              </div>
              <button className="modal-close" onClick={handleCloseAddModal}>
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleCreateUser} noValidate style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              {/* Scrollable Modal Body */}
              <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "20px 24px" }}>
                <div className="form-grid">
                  <div className="form-field">
                    <label>Full Officer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter officer full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Login Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter login username"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Account Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter account password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Official Email Address</label>
                    <input
                      type="email"
                      placeholder="Enter official email address"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>


                  <div className="form-field">
                    <label>Role Privilege *</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="DEPT_ADMIN">Department Admin</option>
                      <option value="VIEWER">Surveillance Viewer (Read Only)</option>
                      <option value="SUPERADMIN">Statewide Superadmin</option>
                    </select>
                  </div>

                  {form.role !== 'SUPERADMIN' ? (
                    <div className="form-field">
                      <label>Assigned Department *</label>
                      <select
                        value={form.department_id}
                        onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                      >
                        {departments.map((d) => (
                          <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-field">
                      <label>Department Scope</label>
                      <input
                        type="text"
                        disabled
                        value="Statewide All Departments (26+)"
                        style={{ opacity: 0.7 }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={13} /> Role Permissions Scope:
                  </div>
                  {form.role === 'SUPERADMIN' && 'Superadmin has unrestricted access to all 33 Gujarat districts, all departments, ANPR watchlist, user creation, and feed ingestion.'}
                  {form.role === 'DEPT_ADMIN' && 'Department Admin can view and manage camera assets, streams, and incident telemetry belonging to their assigned department.'}
                  {form.role === 'VIEWER' && 'Viewer has read-only live viewing privileges on the Map and Video Wall without editing or onboarding controls.'}
                </div>
              </div>

              {/* Fixed Modal Footer */}
              <div className="modal-foot" style={{ flexShrink: 0 }}>
                <button type="button" className="btn" onClick={handleCloseAddModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ gap: '6px' }}>
                  <UserPlus size={15} /> {isSubmitting ? 'Registering User...' : 'Register User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export { UserManagementPage as UserManagementModal };

