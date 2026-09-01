/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

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
  RefreshCw,
  PieChart,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Eye
} from 'lucide-react';

export const Header = ({ activeView, onViewChange, onSyncFeeds, onOpenGap, departmentCount = 26 }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncFeeds();
    setIsSyncing(false);
  };

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
      {/* Left Section: Logo, Title & View Switcher */}
      <div className="header-left">
        <div className="brand">
          <LogoBadge size={38} />
          <div className="brand-text">
            <div className="title">
              GUJRAKSHA <span className="brand-tag">NETRA</span>
            </div>
            <div className="subtitle">Statewide CCTV Surveillance GIS — Gujarat</div>
          </div>
        </div>

        <div className="header-nav-divider"></div>

        {/* View Switcher Pills - Anchored on Left Beside Brand */}
        <div className="view-switcher">
          <button
            className={activeView === 'map' ? 'active' : ''}
            onClick={() => onViewChange('map')}
          >
            <MapPin size={15} strokeWidth={2} /> GIS Map
          </button>
          {isAdmin && (
            <>
              <button
                className={activeView === 'registry' ? 'active' : ''}
                onClick={() => onViewChange('registry')}
              >
                <Camera size={15} strokeWidth={2} /> Cameras
              </button>
              <button
                className={activeView === 'departments' ? 'active' : ''}
                onClick={() => onViewChange('departments')}
              >
                <Building2 size={15} strokeWidth={2} /> Departments ({departmentCount})
              </button>
              <button
                className={activeView === 'videowall' ? 'active' : ''}
                onClick={() => onViewChange('videowall')}
              >
                <LayoutGrid size={15} strokeWidth={2} /> Video Wall
              </button>
              <button
                className={activeView === 'anpr' ? 'active' : ''}
                onClick={() => onViewChange('anpr')}
              >
                <Car size={15} strokeWidth={2} /> AI Vision & ANPR
              </button>
            </>
          )}
        </div>
      </div>

      <div className="header-actions">
        {isAdmin && (
          <>
            <button className="btn" onClick={handleSyncClick} disabled={isSyncing}>
              <RefreshCw size={15} strokeWidth={2} style={{ animation: isSyncing ? 'radarSpin 1s linear infinite' : 'none' }} />
              {isSyncing ? 'Syncing...' : 'Sync Feeds'}
            </button>

            <button className="btn" onClick={onOpenGap}>
              <PieChart size={15} strokeWidth={2} /> Gap Analysis
            </button>
          </>
        )}

        {/* Profile Dropdown */}
        <div className="profile-dropdown-wrap" ref={profileRef}>
          <button
            className="profile-trigger"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="profile-avatar">
              <User size={16} strokeWidth={2} />
            </div>
            <div className="profile-info">
              <span className="profile-name">{user?.name || 'User'}</span>
              <span className="profile-role-badge">
                {isAdmin ? <><Shield size={10} strokeWidth={2.5} /> ADMIN</> : <><Eye size={10} strokeWidth={2.5} /> VIEWER</>}
              </span>
            </div>
            <ChevronDown size={14} strokeWidth={2} className={`profile-chevron ${isProfileOpen ? 'open' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="profile-dropdown-menu">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  <User size={20} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="profile-dropdown-name">{user?.name}</div>
                  <div className="profile-dropdown-dept">{user?.department}</div>
                </div>
              </div>

              <div className="profile-dropdown-divider"></div>

              <button className="profile-dropdown-item" onClick={() => { toggleTheme(); setIsProfileOpen(false); }}>
                {theme === 'dark' ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
                <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                <span className="profile-theme-pill">{theme === 'dark' ? 'ON' : 'OFF'}</span>
              </button>

              <div className="profile-dropdown-divider"></div>

              <button className="profile-dropdown-item logout" onClick={() => { logout(); setIsProfileOpen(false); }}>
                <LogOut size={15} strokeWidth={2} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
