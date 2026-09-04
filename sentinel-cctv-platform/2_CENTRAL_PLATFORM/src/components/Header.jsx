import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { LogoBadge } from './Logo';
import {
  MapPin,
  Camera,
  Building2,
  LayoutGrid,
  Car,
  Moon,
  Sun,
  PieChart,
  User,
  Users,
  LogOut,
  ChevronDown,
  Shield,
  Eye,
  Sparkles,
  Menu,
  X
} from 'lucide-react';

export const Header = ({ activeView, onViewChange, onOpenGap, onOpenUserMgmt, departmentCount = 26 }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      {/* Left Section: Brand Logo & Title */}
      <div className="header-left">
        <div className="brand" onClick={() => onViewChange('map')} title="GujRaksha Netra GIS Command Platform">
          <LogoBadge size={34} />
          <div className="brand-text">
            <div className="title">
              GUJRAKSHA <span className="brand-tag">NETRA</span>
            </div>
            <div className="subtitle">Statewide CCTV Command GIS</div>
          </div>
        </div>

        <div className="header-nav-divider"></div>

        {/* View Switcher Pills */}
        <nav className="view-switcher" aria-label="Primary Navigation">
          <button
            className={activeView === 'map' ? 'active' : ''}
            onClick={() => onViewChange('map')}
            title="Statewide GIS Map Control & Tactical Feeds"
          >
            <MapPin size={15} strokeWidth={2.2} />
            <span>GIS Map</span>
          </button>
          {isAdmin && (
            <>
              <button
                className={activeView === 'registry' ? 'active' : ''}
                onClick={() => onViewChange('registry')}
                title="CCTV Camera Asset Registry & Diagnostics"
              >
                <Camera size={15} strokeWidth={2.2} />
                <span>Cameras</span>
              </button>
              <button
                className={activeView === 'departments' ? 'active' : ''}
                onClick={() => onViewChange('departments')}
                title={`Department Hierarchy Directory (${departmentCount} Departments)`}
              >
                <Building2 size={15} strokeWidth={2.2} />
                <span>Departments ({departmentCount})</span>
              </button>
              <button
                className={activeView === 'videowall' ? 'active' : ''}
                onClick={() => onViewChange('videowall')}
                title="Live Multi-Camera Tactical Video Wall Matrix"
              >
                <LayoutGrid size={15} strokeWidth={2.2} />
                <span>Video Wall</span>
              </button>
              <button
                className={activeView === 'anpr' ? 'active' : ''}
                onClick={() => onViewChange('anpr')}
                title="AI Vision Intelligence & ANPR Vehicle Intercept"
              >
                <Car size={15} strokeWidth={2.2} />
                <span>AI Vision & ANPR</span>
              </button>
              <button
                className={activeView === 'users' ? 'active' : ''}
                onClick={() => onViewChange('users')}
                title="User RBAC Access Control & System Permissions"
              >
                <Users size={15} strokeWidth={2.2} />
                <span>Users & Roles</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Right Section: Command Actions & Profile */}
      <div className="header-actions">
        {isAdmin && (
          <>
            <button
              className="btn btn-sm header-gap-btn"
              onClick={onOpenGap}
              title="Statewide CCTV Density & Blind-Spot Coverage Analysis"
            >
              <PieChart size={14} strokeWidth={2.2} />
              <span>Gap Analysis</span>
            </button>
          </>
        )}


        {/* Quick 1-Click Theme Toggle Button */}
        <button
          className="btn btn-sm btn-icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            width: '34px',
            height: '34px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px'
          }}
        >
          {theme === 'dark' ? (
            <Sun size={15} strokeWidth={2.2} style={{ color: '#f59e0b' }} />
          ) : (
            <Moon size={15} strokeWidth={2.2} style={{ color: '#6366f1' }} />
          )}
        </button>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="btn btn-sm btn-icon mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title={isMobileMenuOpen ? "Close Menu" : "Open Menu"}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? (
            <X size={18} strokeWidth={2.4} style={{ color: "var(--accent)" }} />
          ) : (
            <Menu size={18} strokeWidth={2.4} />
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="profile-dropdown-wrap" ref={profileRef}>
          <button
            className="profile-trigger"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            title="User Profile & Settings"
          >
            <div className="profile-avatar">
              <User size={15} strokeWidth={2.2} />
            </div>
            <div className="profile-info">
              <span className="profile-name">{user?.name || 'Operator'}</span>
              <span className="profile-role-badge">
                {isAdmin ? (
                  <><Shield size={10} strokeWidth={2.5} /> ADMIN</>
                ) : (
                  <><Eye size={10} strokeWidth={2.5} /> VIEWER</>
                )}
              </span>
            </div>
            <ChevronDown size={13} strokeWidth={2.2} className={`profile-chevron ${isProfileOpen ? 'open' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="profile-dropdown-menu">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  <User size={18} strokeWidth={2} />
                </div>
                <div>
                  <div className="profile-dropdown-name">{user?.name}</div>
                  <div className="profile-dropdown-dept">{user?.department || 'Gujarat Police'}</div>
                </div>
              </div>

              <div className="profile-dropdown-divider"></div>

              <button className="profile-dropdown-item logout" onClick={() => { logout(); setIsProfileOpen(false); }}>
                <LogOut size={14} strokeWidth={2} />
                <span>Logout Session</span>
              </button>

            </div>
          )}
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-drawer" ref={mobileMenuRef}>
          <div className="mobile-nav-links">
            <button
              className={activeView === 'map' ? 'active' : ''}
              onClick={() => {
                onViewChange('map');
                setIsMobileMenuOpen(false);
              }}
            >
              <MapPin size={16} strokeWidth={2.2} />
              <span>GIS Map</span>
            </button>

            {isAdmin && (
              <>
                <button
                  className={activeView === 'registry' ? 'active' : ''}
                  onClick={() => {
                    onViewChange('registry');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Camera size={16} strokeWidth={2.2} />
                  <span>Cameras Registry</span>
                </button>
                <button
                  className={activeView === 'departments' ? 'active' : ''}
                  onClick={() => {
                    onViewChange('departments');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Building2 size={16} strokeWidth={2.2} />
                  <span>Departments ({departmentCount})</span>
                </button>
                <button
                  className={activeView === 'videowall' ? 'active' : ''}
                  onClick={() => {
                    onViewChange('videowall');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LayoutGrid size={16} strokeWidth={2.2} />
                  <span>Video Wall Grid</span>
                </button>
                <button
                  className={activeView === 'anpr' ? 'active' : ''}
                  onClick={() => {
                    onViewChange('anpr');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Car size={16} strokeWidth={2.2} />
                  <span>AI Vision & ANPR</span>
                </button>
                <button
                  className={activeView === 'users' ? 'active' : ''}
                  onClick={() => {
                    onViewChange('users');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Users size={16} strokeWidth={2.2} />
                  <span>Users & Roles</span>
                </button>
                <button
                  className="mobile-gap-analysis-btn"
                  onClick={() => {
                    onOpenGap();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <PieChart size={16} strokeWidth={2.2} />
                  <span>Statewide Gap Analysis</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};


