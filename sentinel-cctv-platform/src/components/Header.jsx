/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Radar,
  MapPin,
  Table,
  Moon,
  Sun,
  RefreshCw,
  PieChart
} from 'lucide-react';

export const Header = ({ activeView, onViewChange, onSyncFeeds, onOpenGap }) => {
  const { theme, toggleTheme } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncFeeds();
    setIsSyncing(false);
  };

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">
          <div className="sweep"></div>
          <Radar size={18} strokeWidth={2.2} style={{ position: 'relative', zIndex: 2 }} />
        </div>
        <div className="brand-text">
          <div className="title">GUJRAKSHA <span style={{ color: 'var(--accent)' }}>·</span> NETRA</div>
          <div className="subtitle">Statewide CCTV Surveillance GIS — Gujarat</div>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div className="view-switcher">
        <button
          className={activeView === 'map' ? 'active' : ''}
          onClick={() => onViewChange('map')}
        >
          <MapPin size={15} strokeWidth={2} /> GIS Map
        </button>
        <button
          className={activeView === 'registry' ? 'active' : ''}
          onClick={() => onViewChange('registry')}
        >
          <Table size={15} strokeWidth={2} /> Table Registry
        </button>
      </div>

      <div className="header-actions">
        <button className="btn btn-icon" onClick={toggleTheme} title="Toggle Dark / Light Theme">
          {theme === 'dark' ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
        </button>

        <button className="btn" onClick={handleSyncClick} disabled={isSyncing}>
          <RefreshCw size={15} strokeWidth={2} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'radarSpin 1s linear infinite' : 'none' }} />
          {isSyncing ? 'Syncing...' : 'Sync Feeds'}
        </button>

        <button className="btn" onClick={onOpenGap}>
          <PieChart size={15} strokeWidth={2} /> Gap Analysis
        </button>
      </div>
    </header>
  );
};
