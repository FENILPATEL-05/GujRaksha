import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'ADMIN', name: 'State Command Admin', department: 'Home Department' },
  { username: 'viewer', password: 'viewer123', role: 'VIEWER', name: 'GIS Surveillance Viewer', department: 'Public Safety' }
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

  const login = (username, password) => {
    const found = DEFAULT_USERS.find(
      u => u.username === username && u.password === password
    );
    if (found) {
      const { password: _, ...safeUser } = found;
      setUser(safeUser);
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials. Access denied.' };
  };

  const logout = () => {
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isViewer = user?.role === 'VIEWER';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isViewer, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
