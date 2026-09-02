import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Shield,
  ShieldAlert,
  Building2,
  Trash2,
  Lock,
  Mail,
  User,
  Key,
  CheckCircle2,
  AlertCircle,
  Eye,
  Crown
} from 'lucide-react';

export const UserManagementModal = ({ isOpen, onClose, departments = [], addToast }) => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (isOpen) {
      fetchUsers();
      setActiveTab('list');
      setForm({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'DEPT_ADMIN',
        department_id: departments[0]?.code || 'HOME'
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        addToast(`User '${data.data?.name}' (${data.data?.role}) registered successfully!`, 'success', 'User Registered');
        setForm({
          name: '',
          username: '',
          email: '',
          password: '',
          role: 'DEPT_ADMIN',
          department_id: departments[0]?.code || 'HOME'
        });
        setActiveTab('list');
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

  const handleDeleteUser = async (user) => {
    if (user.username === 'superadmin' || user.username === 'admin') {
      addToast('Primary Superadmin account cannot be deleted.', 'error', 'Protected Account');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user '${user.name}' (${user.username}) from GujRaksha?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/auth/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast(`User '${user.name}' removed successfully.`, 'success', 'User Deleted');
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

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: '1200px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Head */}
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>Statewide User & Department Access Management</h3>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Navigation Switcher Tabs */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--panel-border)', background: 'var(--input-bg)', display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${activeTab === 'list' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('list')}
            style={{ gap: '6px' }}
          >
            <Users size={14} /> Registered Users ({users.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'create' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('create')}
            style={{ gap: '6px' }}
          >
            <UserPlus size={14} /> Register Department User
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'list' ? (
            <div className="table-wrap" style={{ margin: 0, maxHeight: '520px' }}>
              <table>
                <thead>
                  <tr>
                    <th>User & Identity</th>
                    <th>Role</th>
                    <th>Assigned Department</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                        {isLoading ? 'Loading system users...' : 'No users registered.'}
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {u.name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>
                            @{u.username}
                          </div>
                        </td>

                        <td>
                          {renderRoleBadge(u.role)}
                        </td>

                        <td>
                          <span className="dept-tag" style={{ fontSize: '11px' }}>
                            {u.role === 'SUPERADMIN' ? 'Statewide (All 26+ Depts)' : (u.department_name || u.department_id)}
                          </span>
                        </td>

                        <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {u.email}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          {u.username !== 'superadmin' && u.username !== 'admin' ? (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleDeleteUser(u)}
                              title="Delete User"
                              style={{ color: 'var(--danger)', borderColor: 'rgba(248, 113, 113, 0.3)', padding: '3px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>Protected</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="form-field">
                <label>Full Officer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Inspector K. V. Jadeja"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Username / Login ID *</label>
                <input
                  type="text"
                  placeholder="e.g. kv_jadeja_police"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  required
                />
              </div>

              <div className="form-field">
                <label>Official Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. kv.jadeja@gujarat.gov.in"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Password *</label>
                <input
                  type="password"
                  placeholder="Enter secure password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label>User Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="DEPT_ADMIN">🏢 Department Admin (Restricted to Department)</option>
                  <option value="VIEWER">👁️ Spatial Viewer (Read-Only GIS & Live Streams)</option>
                  <option value="SUPERADMIN">👑 Superadmin (Full Statewide Command Center)</option>
                </select>
              </div>

              {form.role !== 'SUPERADMIN' ? (
                <div className="form-field">
                  <label>Assign Department *</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.code})
                      </option>
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

              <div style={{ gridColumn: '1 / -1', background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={13} /> Role Permissions Scope:
                </div>
                {form.role === 'SUPERADMIN' && 'Superadmin has unrestricted access to all 33 Gujarat districts, all departments, ANPR watchlist, user creation, and feed ingestion.'}
                {form.role === 'DEPT_ADMIN' && 'Department Admin can only view and manage camera assets, streams, and incident telemetry belonging to their assigned department.'}
                {form.role === 'VIEWER' && 'Viewer has read-only live viewing privileges on the Map and Video Wall without editing or onboarding controls.'}
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn" onClick={() => setActiveTab('list')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ gap: '6px' }}>
                  <UserPlus size={15} /> {isSubmitting ? 'Registering User...' : 'Register User Account'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Foot */}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
