/**
 * GujRaksha (ગુજ રક્ષા) — Statewide CCTV Asset Registry & Spatial GIS Control Platform
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 * Proprietary & Confidential — Unauthorized copying or distribution is strictly prohibited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { FloatingFilterBar } from './components/FloatingFilterBar';
import { FloatingStatsCard } from './components/FloatingStatsCard';
import { FloatingCameraTray } from './components/FloatingCameraTray';
import { CameraRegistryPage } from './components/CameraRegistryPage';
import { DepartmentDirectoryPage } from './components/DepartmentDirectoryPage';
import { VideoWallPage } from './components/VideoWallPage';
import { ANPRIntelligencePage } from './components/ANPRIntelligencePage';
import { StreamModal } from './components/StreamModal';
import { OnboardingModal } from './components/OnboardingModal';
import { EditModal } from './components/EditModal';
import { AddDepartmentModal } from './components/AddDepartmentModal';
import { AddWatchlistModal } from './components/AddWatchlistModal';
import { GapAnalysisModal } from './components/GapAnalysisModal';
import { ExportModal } from './components/ExportModal';
import { ToastContainer } from './components/Toast';

export function AppContent() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [activeView, setActiveView] = useState(() => localStorage.getItem('gujraksha_active_view') || 'map'); // 'map', 'registry', 'departments', 'videowall', 'anpr'
  const [cameras, setCameras] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeTrackVehicle, setActiveTrackVehicle] = useState(null);

  useEffect(() => {
    localStorage.setItem('gujraksha_active_view', activeView);
  }, [activeView]);
  const [filters, setFilters] = useState({
    department: 'ALL',
    district: 'ALL',
    status: 'ALL',
    search: ''
  });
  const [selectedCameraForStream, setSelectedCameraForStream] = useState(null);
  const [selectedCameraForEdit, setSelectedCameraForEdit] = useState(null);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState(null);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isAddWatchlistOpen, setIsAddWatchlistOpen] = useState(false);
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

  const fetchCameras = useCallback(async (signal) => {
    const params = new URLSearchParams();
    if (filters.department && filters.department !== 'ALL') params.set('department', filters.department);
    if (filters.district && filters.district !== 'ALL') params.set('district', filters.district);
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.search && filters.search.trim() !== '') params.set('search', filters.search.trim());

    try {
      const queryStr = params.toString();
      const url = `/api/v1/cameras${queryStr ? '?' + queryStr : ''}`;
      const res = await fetch(url, signal ? { signal } : {});
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const json = await res.json();
      if (json && json.success && json.data) {
        setCameras(json.data.cameras || []);
      } else if (json && json.error) {
        console.error('Camera fetch failed with API message:', json.error);
        addToast(json.error.message || 'Failed to load camera registry dataset.', 'error', 'Fetch Error');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was aborted by newer filter input, do not show error toast
        return;
      }
      console.error('Error fetching cameras:', err);
      addToast('Failed to load camera registry dataset.', 'error', 'Fetch Error');
    }
  }, [filters]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/departments');
      const json = await res.json();
      if (json.success) {
        setDepartments(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  }, []);

  // Fetch departments independently on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchDepartments();
    }
  }, [fetchDepartments, isAuthenticated]);

  // Fetch cameras with debounced search to prevent race conditions and network flooding
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    const delay = filters.search ? 250 : 0;
    const timer = setTimeout(() => {
      fetchCameras(controller.signal);
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchCameras, filters, isAuthenticated]);

  // Force viewer role to map view only
  useEffect(() => {
    if (!isAdmin && activeView !== 'map') {
      setActiveView('map');
    }
  }, [isAdmin, activeView]);

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
        fetchDepartments();
      } else {
        addToast(data.error.message, 'error', 'Sync Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Sync Network Error');
    }
  };

  const handleTrackVehicleOnMap = (plateNumber) => {
    setActiveTrackVehicle(plateNumber);
    setActiveView('map');
    addToast(`Plotting surveillance trajectory for ${plateNumber} across Gujarat GIS Map...`, 'info', 'Tracing Route');
  };

  const handleDeleteCamera = async (cam) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to remove '${cam.name}' (${cam.camera_code || cam.id}) from the Gujarat CCTV Registry?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/cameras/${cam.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast(`Camera '${cam.name}' successfully removed from registry.`, 'success', 'Camera Asset Deleted');
        fetchCameras();
      } else {
        addToast(data.error ? data.error.message : 'Failed to delete camera', 'error', 'Error');
      }
    } catch (err) {
      addToast(err.message, 'error', 'Network Error');
    }
  };

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <Header
        activeView={activeView}
        onViewChange={(view) => setActiveView(view)}
        onSyncFeeds={handleSyncGovFeeds}
        onOpenGap={() => setIsGapOpen(true)}
        departmentCount={departments.length || 26}
      />

      {activeView === 'map' ? (
        <div className="map-hero-workspace">
          {/* Floating Top Filter Bar */}
          <FloatingFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onExportCsv={() => setIsExportOpen(true)}
            departments={departments}
          />

          {/* Floating Top Left Stats Card */}
          <FloatingStatsCard cameras={cameras} />

          {/* Hero Full Map */}
          <MapView
            cameras={cameras}
            onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
            activeTrackVehicle={activeTrackVehicle}
            onClearTrackVehicle={() => setActiveTrackVehicle(null)}
          />
        </div>
      ) : activeView === 'registry' && isAdmin ? (
        <CameraRegistryPage
          cameras={cameras}
          filters={filters}
          onFilterChange={handleFilterChange}
          onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
          onEditCamera={(cam) => setSelectedCameraForEdit(cam)}
          onDeleteCamera={handleDeleteCamera}
          onExportCsv={() => setIsExportOpen(true)}
          onAddCamera={() => setIsOnboardOpen(true)}
          departments={departments}
        />
      ) : activeView === 'departments' && isAdmin ? (
        <DepartmentDirectoryPage
          departments={departments}
          onRefresh={fetchDepartments}
          onOpenAddDept={() => {
            setSelectedDeptForEdit(null);
            setIsAddDeptOpen(true);
          }}
          onEditDept={(dept) => {
            setSelectedDeptForEdit(dept);
            setIsAddDeptOpen(true);
          }}
          onViewCamerasForDept={(deptCode) => {
            handleFilterChange('department', deptCode);
            setActiveView('registry');
          }}
          addToast={addToast}
        />
      ) : activeView === 'videowall' && isAdmin ? (
        <VideoWallPage
          cameras={cameras}
          departments={departments}
          onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
          addToast={addToast}
        />
      ) : activeView === 'anpr' && isAdmin ? (
        <ANPRIntelligencePage
          onTrackVehicleOnMap={handleTrackVehicleOnMap}
          onOpenAddWatchlist={() => setIsAddWatchlistOpen(true)}
          onCameraSelect={(cam) => setSelectedCameraForStream(cam)}
          cameras={cameras}
          addToast={addToast}
        />
      ) : null}

      <StreamModal
        camera={selectedCameraForStream}
        onClose={() => setSelectedCameraForStream(null)}
        onEditCamera={(cam) => {
          setSelectedCameraForStream(null);
          setSelectedCameraForEdit(cam);
        }}
      />

      <EditModal
        camera={selectedCameraForEdit}
        onClose={() => setSelectedCameraForEdit(null)}
        onSaveSuccess={() => {
          fetchCameras();
          fetchDepartments();
        }}
        addToast={addToast}
        departments={departments}
      />

      <OnboardingModal
        isOpen={isOnboardOpen}
        onClose={() => setIsOnboardOpen(false)}
        onRegisterSuccess={() => {
          fetchCameras();
          fetchDepartments();
        }}
        addToast={addToast}
        departments={departments}
      />


      <AddDepartmentModal
        isOpen={isAddDeptOpen}
        onClose={() => {
          setIsAddDeptOpen(false);
          setSelectedDeptForEdit(null);
        }}
        onSaveSuccess={() => {
          fetchDepartments();
          fetchCameras();
        }}
        addToast={addToast}
        editingDept={selectedDeptForEdit}
      />

      <AddWatchlistModal
        isOpen={isAddWatchlistOpen}
        onClose={() => setIsAddWatchlistOpen(false)}
        onSaveSuccess={() => {
          fetchCameras();
        }}
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
