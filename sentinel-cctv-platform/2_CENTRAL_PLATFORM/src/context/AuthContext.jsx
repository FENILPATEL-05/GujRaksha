import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const FALLBACK_USERS = [
  { username: 'superadmin', email: 'admin@gujarat.gov.in', password: 'admin123', role: 'SUPERADMIN', name: 'State Command Superadmin', department_id: 'ALL', department_name: 'Statewide Command Center' },
  { username: 'admin', email: 'admin@gujarat.gov.in', password: 'admin123', role: 'SUPERADMIN', name: 'State Command Superadmin', department_id: 'ALL', department_name: 'Statewide Command Center' }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('gujraksha_user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('gujraksha_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('gujraksha_user');
    }
  }, [user]);

  const login = async (username, password) => {
    const cleanUsername = String(username || '').trim().toLowerCase();
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password })
      });
      const data = await res.json();
      if (data.success && data.data?.user) {
        setUser(data.data.user);
        return { success: true, user: data.data.user };
      } else if (data.error) {
        return { success: false, error: data.error.message || 'Invalid credentials.' };
      }
    } catch (e) {
      // Fallback offline authentication
      const found = FALLBACK_USERS.find(
        u => (u.username.toLowerCase() === cleanUsername || (u.email && u.email.toLowerCase() === cleanUsername)) && u.password === password
      );
      if (found) {
        const { password: _, ...safeUser } = found;
        setUser(safeUser);
        return { success: true, user: safeUser };
      }
      return { success: false, error: 'Authentication service unavailable.' };
    }
    return { success: false, error: 'Invalid credentials. Access denied.' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('gujraksha_user');
  };

  const isSuperAdmin = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
  const isDeptAdmin = user?.role === 'DEPT_ADMIN';
  const isViewer = user?.role === 'VIEWER';
  const isAdmin = isSuperAdmin || isDeptAdmin; // Can manage cameras
  const userDepartmentId = isSuperAdmin ? 'ALL' : (user?.department_id || 'ALL');
  const userDepartmentName = user?.department_name || 'Statewide Command Center';

  const canManageUsers = isSuperAdmin;
  const canManageDepartments = isSuperAdmin;
  const canManageCameras = isSuperAdmin || isDeptAdmin;
  const canManageWatchlist = isSuperAdmin || (isDeptAdmin && (user?.department_id === 'HOME' || user?.department_id === 'POLICE'));
  const canSyncFeeds = isSuperAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isSuperAdmin,
      isDeptAdmin,
      isViewer,
      isAdmin,
      userDepartmentId,
      userDepartmentName,
      canManageUsers,
      canManageDepartments,
      canManageCameras,
      canManageWatchlist,
      canSyncFeeds,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

