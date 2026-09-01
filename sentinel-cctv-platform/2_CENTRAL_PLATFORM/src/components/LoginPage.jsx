import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogoBadge } from './Logo';
import { Eye, EyeOff, ShieldCheck, LogIn, Radar } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate brief auth delay
    await new Promise(r => setTimeout(r, 600));

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error || 'Invalid credentials. Access denied.');
    }
    setIsLoading(false);
  };

  const handleFillCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-ambient"></div>
      <div className="login-card">
        <div className="login-header">
          <LogoBadge size={48} />
          <div className="login-brand-text">
            <div className="login-title">
              GUJRAKSHA <span className="brand-tag">NETRA</span>
            </div>
            <div className="login-subtitle">Statewide CCTV Surveillance GIS — Gujarat</div>
          </div>
        </div>

        <div className="login-divider"></div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label>Username / Email ID</label>
            <input
              type="text"
              placeholder="e.g. superadmin, police_admin, rto_admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="login-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <ShieldCheck size={14} strokeWidth={2.2} /> {error}
            </div>
          )}

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <><Radar size={16} strokeWidth={2} style={{ animation: 'radarSpin 1s linear infinite' }} /> Authenticating...</>
            ) : (
              <><LogIn size={16} strokeWidth={2.2} /> Secure Login</>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="login-creds">
            <div className="login-cred-title"><ShieldCheck size={12} strokeWidth={2.2} /> Quick Access Role Credentials (Click to fill)</div>
            <div className="login-cred-row" style={{ cursor: 'pointer' }} onClick={() => handleFillCredentials('superadmin', 'admin123')}>
              <span className="login-cred-role" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>Superadmin</span>
              <code>superadmin</code> / <code>admin123</code>
            </div>
            <div className="login-cred-row" style={{ cursor: 'pointer' }} onClick={() => handleFillCredentials('police_admin', 'police123')}>
              <span className="login-cred-role" style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee' }}>Police Admin</span>
              <code>police_admin</code> / <code>police123</code>
            </div>
            <div className="login-cred-row" style={{ cursor: 'pointer' }} onClick={() => handleFillCredentials('rto_admin', 'rto123')}>
              <span className="login-cred-role" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>Transport Admin</span>
              <code>rto_admin</code> / <code>rto123</code>
            </div>
            <div className="login-cred-row" style={{ cursor: 'pointer' }} onClick={() => handleFillCredentials('viewer', 'viewer123')}>
              <span className="login-cred-role">Viewer (Read-Only)</span>
              <code>viewer</code> / <code>viewer123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
