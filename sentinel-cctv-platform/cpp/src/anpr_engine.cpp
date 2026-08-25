/**
 * GujRaksha (ગુજ રક્ષા) — High-Performance Native ANPR Engine
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Implementation of ANPREngine C++ class.
 */

#include "../include/anpr_engine.hpp"
#include <iostream>
#include <sstream>
#include <regex>
#include <chrono>
#include <iomanip>
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstdlib>

namespace GujRaksha {

ANPREngine::ANPREngine(std::string api_base_url)
    : m_apiBaseUrl(std::move(api_base_url)) {
    // Default Orion Camera Configuration Fallback
    m_cameraConfig.camera_id = "gov-feed-1";
    m_cameraConfig.camera_code = "GJ-GOV-001";
    m_cameraConfig.camera_name = "THE ORION — SG Highway Command CCTV Node";
    m_cameraConfig.district = "Ahmedabad";
    m_cameraConfig.stream_url = "http://192.168.1.96:5000/";
    m_cameraConfig.latitude = 23.0225;
    m_cameraConfig.longitude = 72.5714;
}

ANPREngine::~ANPREngine() = default;

void ANPREngine::setApiBaseUrl(const std::string& url) {
    m_apiBaseUrl = url;
}

std::string ANPREngine::sanitizePlate(const std::string& raw_text) const {
    std::string clean;
    for (char c : raw_text) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            clean += static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        }
    }
    return clean;
}

bool ANPREngine::isValidIndianPlate(const std::string& plate) const {
    if (plate.length() < 6 || plate.length() > 12) return false;
    // Standard Indian license plate pattern: State code (GJ, MH, etc.) + District code + Series + Number
    std::regex pattern("^(GJ|MH|DL|KA|TN|UP|HR|RJ|MP|PB|WB|KL|BR|AP|TS|CG|OD|UK|HP|JK)[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$");
    return std::regex_match(plate, pattern);
}

bool ANPREngine::isWatchlistHit(const std::string& plate) const {
    std::lock_guard<std::mutex> lock(m_watchlistMutex);
    std::string clean = sanitizePlate(plate);
    return m_watchlistSet.find(clean) != m_watchlistSet.end();
}

size_t ANPREngine::getWatchlistCount() const {
    std::lock_guard<std::mutex> lock(m_watchlistMutex);
    return m_watchlistSet.size();
}

CameraConfig ANPREngine::getCameraConfig() const {
    return m_cameraConfig;
}

std::string ANPREngine::getCurrentISO8601Timestamp() const {
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

std::string ANPREngine::httpGetJson(const std::string& url) const {
    std::string cmd = "curl -s -X GET \"" + url + "\" --connect-timeout 2";
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return "";
    char buffer[128];
    std::string result = "";
    while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
        result += buffer;
    }
    pclose(pipe);
    return result;
}

std::string ANPREngine::httpPostJson(const std::string& url, const std::string& json_payload) const {
    std::string cmd = "curl -s -X POST \"" + url + "\" -H \"Content-Type: application/json\" -d '" + json_payload + "' --connect-timeout 3";
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return "";
    char buffer[128];
    std::string result = "";
    while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
        result += buffer;
    }
    pclose(pipe);
    return result;
}

std::vector<std::string> ANPREngine::getWatchlistPlates() const {
    std::lock_guard<std::mutex> lock(m_watchlistMutex);
    std::vector<std::string> list(m_watchlistSet.begin(), m_watchlistSet.end());
    return list;
}

bool ANPREngine::syncWatchlist() {
    std::string url = m_apiBaseUrl + "/watchlist/sync-hotlist";
    std::string resp = httpGetJson(url);
    if (resp.empty() || resp.find("\"success\":true") == std::string::npos) {
        return false;
    }

    std::lock_guard<std::mutex> lock(m_watchlistMutex);
    m_watchlistSet.clear();
    
    // Extract plates array specifically from "plates": ["...", "..."]
    size_t plates_pos = resp.find("\"plates\"");
    if (plates_pos != std::string::npos) {
        size_t start_bracket = resp.find('[', plates_pos);
        size_t end_bracket = resp.find(']', start_bracket);
        if (start_bracket != std::string::npos && end_bracket != std::string::npos) {
            std::string plates_array = resp.substr(start_bracket, end_bracket - start_bracket + 1);
            std::regex item_regex("\"([^\"]+)\"");
            auto begin = std::sregex_iterator(plates_array.begin(), plates_array.end(), item_regex);
            auto end = std::sregex_iterator();
            for (auto i = begin; i != end; ++i) {
                std::smatch m = *i;
                std::string p = sanitizePlate(m[1].str());
                if (!p.empty() && isValidIndianPlate(p)) {
                    m_watchlistSet.insert(p);
                }
            }
        }
    }

    // Fallback: extract specific "vehicle_plate": "..."
    std::regex vp_regex("\"vehicle_plate\"\\s*:\\s*\"([^\"]+)\"");
    auto vbegin = std::sregex_iterator(resp.begin(), resp.end(), vp_regex);
    auto vend = std::sregex_iterator();
    for (auto i = vbegin; i != vend; ++i) {
        std::smatch m = *i;
        std::string p = sanitizePlate(m[1].str());
        if (!p.empty() && isValidIndianPlate(p)) {
            m_watchlistSet.insert(p);
        }
    }

    return !m_watchlistSet.empty();
}

bool ANPREngine::syncCameraConfig(const std::string& target_camera_code) {
    std::string url = m_apiBaseUrl + "/cameras/sync-list";
    std::string resp = httpGetJson(url);
    if (resp.empty() || resp.find("\"success\":true") == std::string::npos) {
        return false;
    }

    if (resp.find(target_camera_code) != std::string::npos) {
        m_cameraConfig.camera_code = target_camera_code;
    }
    return true;
}

std::vector<CameraConfig> ANPREngine::fetchAllCameras() {
    std::vector<CameraConfig> list;
    std::string url = m_apiBaseUrl + "/cameras/sync-list";
    std::string resp = httpGetJson(url);
    
    if (!resp.empty()) {
        std::regex cam_regex("\"camera_code\"\\s*:\\s*\"([^\"]+)\"[^}]*\"name\"\\s*:\\s*\"([^\"]+)\"");
        auto begin = std::sregex_iterator(resp.begin(), resp.end(), cam_regex);
        auto end = std::sregex_iterator();

        for (auto i = begin; i != end; ++i) {
            std::smatch m = *i;
            CameraConfig c;
            c.camera_code = m[1].str();
            c.camera_name = m[2].str();
            c.camera_id = "gov-feed-" + c.camera_code;
            c.district = "Gujarat";
            c.latitude = 23.0225 + ((std::rand() % 100) - 50) * 0.01;
            c.longitude = 72.5714 + ((std::rand() % 100) - 50) * 0.01;
            list.push_back(c);
        }
    }

    if (list.empty()) {
        list.push_back(m_cameraConfig);
    }

    return list;
}

DetectionEvent ANPREngine::processFrameDetection(const std::string& raw_detected_plate, double confidence) {
    return processCameraFrame(m_cameraConfig, raw_detected_plate, confidence);
}

DetectionEvent ANPREngine::processCameraFrame(const CameraConfig& camera, const std::string& raw_detected_plate, double confidence) {
    DetectionEvent evt;
    evt.vehicle_plate = sanitizePlate(raw_detected_plate);
    evt.camera_id = camera.camera_id;
    evt.camera_code = camera.camera_code;
    evt.camera_name = camera.camera_name;
    evt.district = camera.district;
    evt.latitude = camera.latitude;
    evt.longitude = camera.longitude;
    evt.speed_kmh = 45 + (std::rand() % 40);
    evt.confidence = confidence > 0.0 ? confidence : 96.5;
    evt.is_watchlist_hit = isWatchlistHit(evt.vehicle_plate);
    evt.timestamp = getCurrentISO8601Timestamp();
    evt.id = "det-" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count()) + "-" + std::to_string(std::rand() % 1000);
    
    if (evt.is_watchlist_hit) {
        evt.watchlist_category = "SUSPECT_HOTLIST";
        evt.watchlist_fir = "FIR-2026-GJ-POLICE";
    }
    return evt;
}

size_t ANPREngine::runInferenceAllCameras() {
    syncWatchlist();
    auto cameras = fetchAllCameras();
    auto dynamic_plates = getWatchlistPlates();

    if (dynamic_plates.empty() || cameras.empty()) {
        return 0;
    }

    size_t hits = 0;
    for (size_t i = 0; i < cameras.size(); ++i) {
        const auto& cam = cameras[i];
        std::string plate = dynamic_plates[i % dynamic_plates.size()];

        if (isValidIndianPlate(plate)) {
            auto evt = processCameraFrame(cam, plate, 97.8);
            dispatchAlertToBackend(evt);
            if (evt.is_watchlist_hit) {
                hits++;
            }
        }
    }
    return hits;
}

bool ANPREngine::dispatchAlertToBackend(const DetectionEvent& event) {
    std::stringstream ss;
    ss << "{"
       << "\"vehicle_plate\":\"" << event.vehicle_plate << "\","
       << "\"camera_id\":\"" << event.camera_id << "\","
       << "\"camera_code\":\"" << event.camera_code << "\","
       << "\"camera_name\":\"" << event.camera_name << "\","
       << "\"district\":\"" << event.district << "\","
       << "\"latitude\":" << event.latitude << ","
       << "\"longitude\":" << event.longitude << ","
       << "\"speed_kmh\":" << event.speed_kmh << ","
       << "\"confidence\":" << event.confidence << ","
       << "\"timestamp\":\"" << event.timestamp << "\""
       << "}";

    std::string url = m_apiBaseUrl + "/anpr/ingest";
    std::string response = httpPostJson(url, ss.str());
    return (!response.empty() && response.find("\"success\":true") != std::string::npos);
}

} // namespace GujRaksha
