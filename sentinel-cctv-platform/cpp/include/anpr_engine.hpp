/**
 * GujRaksha (ગુજ રક્ષા) — High-Performance Native ANPR Engine
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Header file for C++ License Plate Detection, Indian Plate Formatting,
 * Watchlist Hotlist Synchronization, and REST API Ingestion Dispatch.
 */

#ifndef ANPR_ENGINE_HPP
#define ANPR_ENGINE_HPP

#include <string>
#include <vector>
#include <unordered_set>
#include <mutex>
#include <memory>

namespace GujRaksha {

struct CameraConfig {
    std::string camera_id;
    std::string camera_code;
    std::string camera_name;
    std::string district;
    std::string stream_url;
    double latitude{23.0225};
    double longitude{72.5714};
};

struct DetectionEvent {
    std::string id;
    std::string vehicle_plate;
    std::string vehicle_type;
    std::string vehicle_color;
    std::string camera_id;
    std::string camera_code;
    std::string camera_name;
    std::string district;
    double latitude;
    double longitude;
    int speed_kmh;
    double confidence;
    bool is_watchlist_hit;
    std::string watchlist_category;
    std::string watchlist_fir;
    std::string timestamp;
};

class ANPREngine {
public:
    ANPREngine(std::string api_base_url = "http://localhost:3000/api/v1");
    ~ANPREngine();

    // Configuration & Hotlist management
    void setApiBaseUrl(const std::string& url);
    bool syncWatchlist();
    bool syncCameraConfig(const std::string& target_camera_code = "GJ-GOV-001");
    std::vector<CameraConfig> fetchAllCameras();
    
    // Core ANPR processing
    std::string sanitizePlate(const std::string& raw_text) const;
    bool isValidIndianPlate(const std::string& plate) const;
    bool isWatchlistHit(const std::string& plate) const;

    // Detection & Alert Dispatch
    DetectionEvent processFrameDetection(const std::string& raw_detected_plate, double confidence);
    DetectionEvent processCameraFrame(const CameraConfig& camera, const std::string& raw_detected_plate, double confidence);
    bool dispatchAlertToBackend(const DetectionEvent& event);
    size_t runInferenceAllCameras();

    // Getters
    size_t getWatchlistCount() const;
    std::vector<std::string> getWatchlistPlates() const;
    CameraConfig getCameraConfig() const;

private:
    std::string m_apiBaseUrl;
    CameraConfig m_cameraConfig;
    std::unordered_set<std::string> m_watchlistSet;
    mutable std::mutex m_watchlistMutex;

    std::string getCurrentISO8601Timestamp() const;
    std::string httpPostJson(const std::string& url, const std::string& json_payload) const;
    std::string httpGetJson(const std::string& url) const;
};

} // namespace GujRaksha

#endif // ANPR_ENGINE_HPP
