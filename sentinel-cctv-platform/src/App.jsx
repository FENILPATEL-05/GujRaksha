/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { FloatingFilterBar } from './components/FloatingFilterBar';
import { FloatingStatsCard } from './components/FloatingStatsCard';
import { FloatingCameraTray } from './components/FloatingCameraTray';
import { CameraRegistryPage } from './components/CameraRegistryPage';
import { StreamModal } from './components/StreamModal';
import { OnboardingModal } from './components/OnboardingModal';
import { EditModal } from './components/EditModal';
import { GapAnalysisModal } from './components/GapAnalysisModal';
import { ExportModal } from './components/ExportModal';
import { ToastContainer } from './components/Toast';

export function AppContent() {
  const [activeView, setActiveView] = useState('map'); // 'map' or 'registry'
  const [cameras, setCameras] = useState([]);
  const [filters, setFilters] = useState({
    department: 'ALL',
    district: 'ALL',
    status: 'ALL',
    search: ''
  });
  const [selectedCameraForStream, setSelectedCameraForStream] = useState(null);
  const [selectedCameraForEdit, setSelectedCameraForEdit] = useState(null);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [isGapOpen, setIsGapOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', title = '') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchCameras = useCallback(async () => {
    const queryParams = new URLSearchParams(filters);
    try {
      const res = await fetch(`/api/v1/cameras?${queryParams.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCameras(json.data.cameras);
      }
    } catch (err) {
      console.error('Error fetching cameras:', err);
      addToast('Failed to load camera registry dataset.', 'error', 'Fetch Error');
    }
  }, [filters]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSyncGovFeeds = async () => {
    try {
      const res = await fetch('/api/v1/onboarding/sync-gov-feeds', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast(`Successfully synchronized ${data.data.count} live government feeds!`, 'success', 'Sync Complete');
        fetchCameras();
      } else {
        addToast(data.error.message, 'error', 'Sync Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Sync Network Error');
    }
  };

  return (
    <>
      <Header
        activeView={activeView}
        onViewChange={(view) => setActiveView(view)}
        onSyncFeeds={handleSyncGovFeeds}
        onOpenGap={() => setIsGapOpen(true)}
      />

      {activeView === 'map' ? (
        <div className="map-hero-workspace">
          {/* Floating Top Filter Bar */}
          <FloatingFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onExportCsv={() => setIsExportOpen(true)}
          />

          {/* Floating Top Left Stats Card */}
          <FloatingStatsCard cameras={cameras} />

          {/* Hero Full Map */}
          <MapView
            cameras={cameras}
            onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
          />

          {/* Floating Bottom Collapsible Camera Tray */}
          <FloatingCameraTray
            cameras={cameras}
            onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
            onEditCamera={(cam) => setSelectedCameraForEdit(cam)}
          />
        </div>
      ) : (
        <CameraRegistryPage
          cameras={cameras}
          filters={filters}
          onFilterChange={handleFilterChange}
          onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
          onEditCamera={(cam) => setSelectedCameraForEdit(cam)}
          onExportCsv={() => setIsExportOpen(true)}
          onAddCamera={() => setIsOnboardOpen(true)}
        />
      )}

      <StreamModal
        camera={selectedCameraForStream}
        onClose={() => setSelectedCameraForStream(null)}
        onEditCamera={(cam) => {
          setSelectedCameraForStream(null);
          setSelectedCameraForEdit(cam);
        }}
      />

      <OnboardingModal
        isOpen={isOnboardOpen}
        onClose={() => setIsOnboardOpen(false)}
        onRegisterSuccess={fetchCameras}
        addToast={addToast}
      />

      <EditModal
        camera={selectedCameraForEdit}
        onClose={() => setSelectedCameraForEdit(null)}
        onSaveSuccess={fetchCameras}
        addToast={addToast}
      />

      <GapAnalysisModal
        isOpen={isGapOpen}
        onClose={() => setIsGapOpen(false)}
        cameras={cameras}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        cameras={cameras}
        addToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
