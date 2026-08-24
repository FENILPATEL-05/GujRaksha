/**
 * GujRaksha (ગુજ રક્ષા) — Native C++ ANPR Engine CLI Main Entry
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 */

#include "../include/anpr_engine.hpp"
#include <iostream>
#include <string>
#include <vector>
#include <thread>
#include <chrono>

void printUsage() {
    std::cout << "=================================================================\n";
    std::cout << " 🚔 GujRaksha CCTV Native C++ ANPR Engine (Gujarat Police Hackathon)\n";
    std::cout << "=================================================================\n";
    std::cout << "Usage:\n";
    std::cout << "  ./sentinel_anpr_engine [options]\n\n";
    std::cout << "Options:\n";
    std::cout << "  --api <url>          Base API URL (default: http://localhost:3000/api/v1)\n";
    std::cout << "  --camera-code <code> Target Camera Code (default: GJ-GOV-001)\n";
    std::cout << "  --plate <number>     Simulate/Scan single vehicle license plate\n";
    std::cout << "  --test-mode          Run automated ANPR detection & watchlist verification test\n";
    std::cout << "  --help               Display command line options\n";
    std::cout << "=================================================================\n";
}

int main(int argc, char* argv[]) {
    std::string api_url = "http://localhost:3000/api/v1";
    std::string camera_code = "GJ-GOV-001";
    std::string single_plate = "";
    bool test_mode = false;
    bool all_cameras = false;
    bool live_mode = false;
    int interval_ms = 2000;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--api" && i + 1 < argc) {
            api_url = argv[++i];
        } else if (arg == "--camera-code" && i + 1 < argc) {
            camera_code = argv[++i];
        } else if (arg == "--plate" && i + 1 < argc) {
            single_plate = argv[++i];
        } else if (arg == "--test-mode") {
            test_mode = true;
        } else if (arg == "--all-cameras" || arg == "--scan-all") {
            all_cameras = true;
        } else if (arg == "--live" || arg == "--continuous" || arg == "--realtime") {
            live_mode = true;
        } else if (arg == "--interval" && i + 1 < argc) {
            interval_ms = std::max(500, std::stoi(argv[++i]));
        } else if (arg == "--help" || arg == "-h") {
            printUsage();
            return 0;
        }
    }

    std::cout << "⚡ [GujRaksha Native ANPR Engine] Initializing...\n";
    GujRaksha::ANPREngine engine(api_url);

    if (live_mode) {
        std::cout << "🔴 [REAL-TIME ANPR RADAR] Continuous live detection active (Frequency: " << interval_ms << "ms)...\n";
        engine.syncWatchlist();
        while (true) {
            size_t hits = engine.runInferenceAllCameras();
            if (hits > 0) {
                std::cout << "🚨 [REAL-TIME HIT] Dispatched " << hits << " active watchlist hit(s) to GIS Command Center!\n";
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
        }
        return 0;
    }

    if (all_cameras) {
        std::cout << "🌐 Running ANPR Inference across ALL camera nodes on the platform...\n";
        size_t hits = engine.runInferenceAllCameras();
        std::cout << "✅ ANPR Inference completed across all cameras. Watchlist hits dispatched: " << hits << "\n";
        return 0;
    }

    std::cout << "📡 Syncing police hotlist from API: " << api_url << "/watchlist/sync-hotlist...\n";
    bool synced_wl = engine.syncWatchlist();
    std::cout << (synced_wl ? "✓ Watchlist hotlist synced successfully!" : "⚠️ Using fallback police watchlist hotlist.")
              << " Loaded plates count: " << engine.getWatchlistCount() << "\n";

    engine.syncCameraConfig(camera_code);
    auto cam = engine.getCameraConfig();
    std::cout << "🎥 Camera Config Bound: [" << cam.camera_code << "] " << cam.camera_name << " (" << cam.district << ")\n";

    if (!single_plate.empty()) {
        std::cout << "🔍 Scanning License Plate: " << single_plate << "\n";
        auto evt = engine.processFrameDetection(single_plate, 98.4);
        std::cout << "   • Sanitized Plate: " << evt.vehicle_plate << "\n";
        std::cout << "   • Watchlist Hit:   " << (evt.is_watchlist_hit ? "🚨 YES (MATCH DETECTED!)" : "NO (Clean)") << "\n";

        if (evt.is_watchlist_hit) {
            std::cout << "🚨 Dispatching instant hit alert to GujRaksha backend...\n";
            bool sent = engine.dispatchAlertToBackend(evt);
            std::cout << (sent ? "✅ Alert dispatched successfully!" : "⚠️ Backend dispatch finished.") << "\n";
        }
        return 0;
    }

    if (test_mode) {
        std::cout << "🧪 Running Native ANPR Engine Test Suite...\n";
        std::vector<std::string> test_plates = {
            "GJ01AB1234", // Hotlist
            "GJ05XY9999", // Normal
            "GJ01HG9999", // Hotlist
            "GJ27BZ1020"  // Normal
        };

        for (const auto& raw_plate : test_plates) {
            auto evt = engine.processFrameDetection(raw_plate, 97.5);
            std::cout << "  - Plate: " << evt.vehicle_plate 
                      << " | Hit: " << (evt.is_watchlist_hit ? "🚨 WATCHLIST HIT" : "✓ PASS") << "\n";
            if (evt.is_watchlist_hit) {
                engine.dispatchAlertToBackend(evt);
            }
        }
        std::cout << "✅ Native ANPR Engine Test Complete.\n";
        return 0;
    }

    std::cout << "🚀 Native ANPR Engine Active. Standing by for stream triggers...\n";
    return 0;
}
