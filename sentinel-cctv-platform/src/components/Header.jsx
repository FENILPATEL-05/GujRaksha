/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export const Header = ({ activeView, onViewChange, onSyncFeeds, onOpenOnboard, onOpenGap }) => {
  const { theme, toggleTheme } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncFeeds();
    setIsSyncing(false);
  };

  return (
    <header className="gov-navbar-clean">
      <div className="brand-clean">
        <div className="brand-icon-clean">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <div className="brand-title-clean">
          GUJRAKSHA
          <small>CCTV CONTROL</small>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: '20px' }}>
          <button
            className={`btn-clean ${activeView === 'map' ? 'btn-clean-gold' : 'btn-clean-outline'}`}
            onClick={() => onViewChange('map')}
          >
            <i className="fa-solid fa-map"></i> GIS Map
          </button>
          <button
            className={`btn-clean ${activeView === 'registry' ? 'btn-clean-gold' : 'btn-clean-outline'}`}
            onClick={() => onViewChange('registry')}
          >
            <i className="fa-solid fa-table-list"></i> Camera Registry
          </button>
        </div>
      </div>

      <div className="nav-actions-clean">
        {/* Light / Dark Mode Toggle Switch */}
        <button className="theme-btn-clean" onClick={toggleTheme} title="Toggle Light / Dark Mode">
          <div
            className="theme-toggle-pill"
            style={{ transform: theme === 'light' ? 'translateX(16px)' : 'translateX(0px)' }}
          >
            {theme === 'dark' ? <i className="fa-solid fa-moon"></i> : <i className="fa-solid fa-sun"></i>}
          </div>
          <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        <button className="btn-clean btn-clean-outline" onClick={handleSyncClick} disabled={isSyncing}>
          <i className={`fa-solid ${isSyncing ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
          {isSyncing ? 'Syncing...' : 'Sync Feeds'}
        </button>

        <button className="btn-clean btn-clean-outline" onClick={onOpenGap}>
          <i className="fa-solid fa-chart-pie"></i> Gap Analysis
        </button>

        <button className="btn-clean btn-clean-gold" onClick={onOpenOnboard}>
          <i className="fa-solid fa-plus"></i> Add Camera
        </button>
      </div>
    </header>
  );
};
