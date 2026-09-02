import db from '../db/pool.js';

class OnboardingService {
  processBulkCsv(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one camera data row.');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const rows = lines.slice(1);
    const validCameras = [];
    const errors = [];

    rows.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim().replace(/["']/g, ''));
      if (parts.length < 3) return;

      const record = {};
      headers.forEach((h, idx) => {
        record[h] = parts[idx] || '';
      });

      const name = record.name || record.camera_name || `Camera-${index+1}`;
      const lat = parseFloat(record.latitude || record.lat);
      const lng = parseFloat(record.longitude || record.lng || record.lon);
      const dept = record.department || record.department_id || 'HOME';
      const district = record.district || 'Ahmedabad';

      if (isNaN(lat) || isNaN(lng)) {
        errors.push(`Row ${index + 2}: Invalid GPS coordinates (Lat: ${record.latitude}, Lng: ${record.longitude})`);
      } else {
        validCameras.push({
          name: name,
          camera_code: record.camera_code || record.code || '',
          latitude: lat,
          longitude: lng,
          department_id: dept.toUpperCase(),
          department_name: record.department_name || `${dept} Department`,
          district: district,
          taluka: record.taluka || '',
          address: record.address || '',
          ownership_type: (record.ownership || record.ownership_type || 'GOVERNMENT').toUpperCase(),
          camera_type: (record.camera_type || 'PTZ').toUpperCase(),
          detection_mode: (record.detection_mode || record.ai_mode || record.mode || 'GENERAL_SURVEILLANCE').toUpperCase(),
          vms_vendor: record.vms_vendor || 'Live Sentinel Feeder (H264/MP4)',

          status: (record.status || 'ACTIVE').toUpperCase(),
          stream_url: record.stream_url || record.rtsp_url || '',
          rtsp_url: record.rtsp_url || (record.stream_url && record.stream_url.startsWith('rtsp://') ? record.stream_url : ''),
          whep_url: record.whep_url || (record.stream_url && record.stream_url.endsWith('/whep') ? record.stream_url : ''),
          hls_url: record.hls_url || '',
          codec: record.codec || 'H.264',
          retention_days: parseInt(record.retention_days || 15, 10),
          resolution: record.resolution || '1920x1080',
          fps: parseInt(record.fps || 30, 10),
          bitrate: record.bitrate || '4Mbps'
        });
      }
    });

    const added = db.bulkCreate(validCameras);

    return {
      successCount: added.length,
      errorCount: errors.length,
      errors: errors,
      onboardedCameras: added
    };
  }

  // Dynamic Geographic Resolver for Gujarat Locations
  resolveLocationMetadata(locationStr) {
    const loc = (locationStr || '').toLowerCase();

    if (loc.includes('junagadh') || loc.includes('timbavadi') || loc.includes('majewadi') || loc.includes('dolatpara')) {
      return { district: 'Junagadh', lat: 21.5224 + (Math.random() * 0.04 - 0.02), lng: 70.4579 + (Math.random() * 0.04 - 0.02) };
    }
    if (loc.includes('gir somnath') || loc.includes('veraval') || loc.includes('somnath')) {
      return { district: 'Gir Somnath', lat: 20.9000 + (Math.random() * 0.03 - 0.015), lng: 70.3700 + (Math.random() * 0.03 - 0.015) };
    }
    if (loc.includes('gandhinagar') || loc.includes('adalaj') || loc.includes('mohanpura') || loc.includes('dehgam') || loc.includes('kheram')) {
      return { district: 'Gandhinagar', lat: 23.2156 + (Math.random() * 0.06 - 0.03), lng: 72.6369 + (Math.random() * 0.06 - 0.03) };
    }
    if (loc.includes('rajkot')) {
      return { district: 'Rajkot', lat: 22.3039 + (Math.random() * 0.04 - 0.02), lng: 70.8022 + (Math.random() * 0.04 - 0.02) };
    }
    if (loc.includes('navsari') || loc.includes('bilimora') || loc.includes('gandevi') || loc.includes('dhanori') || loc.includes('tankal')) {
      return { district: 'Navsari', lat: 20.8500 + (Math.random() * 0.1 - 0.05), lng: 72.9500 + (Math.random() * 0.1 - 0.05) };
    }
    if (loc.includes('patan')) {
      return { district: 'Patan', lat: 23.8500 + (Math.random() * 0.05 - 0.025), lng: 72.1200 + (Math.random() * 0.05 - 0.025) };
    }
    if (loc.includes('kutch') || loc.includes('gandhidham') || loc.includes('bhuj')) {
      return { district: 'Kutch', lat: 23.0760 + (Math.random() * 0.08 - 0.04), lng: 70.1330 + (Math.random() * 0.08 - 0.04) };
    }
    if (loc.includes('surat') || loc.includes('dumas')) {
      return { district: 'Surat', lat: 21.1702 + (Math.random() * 0.05 - 0.025), lng: 72.8311 + (Math.random() * 0.05 - 0.025) };
    }
    if (loc.includes('vadodara') || loc.includes('alkapuri')) {
      return { district: 'Vadodara', lat: 22.3072 + (Math.random() * 0.04 - 0.02), lng: 73.1812 + (Math.random() * 0.04 - 0.02) };
    }

    // Default to Ahmedabad
    return { district: 'Ahmedabad', lat: 23.0225 + (Math.random() * 0.08 - 0.04), lng: 72.5714 + (Math.random() * 0.08 - 0.04) };
  }

  // Realistic Camera Type Resolver
  resolveCameraType(id, name, locationStr) {
    const loc = (locationStr || name || '').toLowerCase();
    if (loc.includes('tollnaka') || loc.includes('junction') || loc.includes('bypass') || loc.includes('char rasta')) {
      return 'ANPR_SPECIAL';
    }
    if (loc.includes('circle') || loc.includes('bridge') || loc.includes('p2') || loc.includes('gate')) {
      return 'PTZ';
    }
    if (loc.includes('office') || loc.includes('campus') || loc.includes('depot')) {
      return 'DOME_INDOOR';
    }

    const idNum = parseInt(id, 10) || 1;
    const types = ['ANPR_SPECIAL', 'FIXED_BULLET', 'PTZ', 'DOME_INDOOR'];
    return types[idNum % types.length];
  }

  async syncGovernmentLiveFeeds() {
    try {
      console.log('📡 Fetching cameras from https://cctv.corp8.cloud/cameras.json...');
      let rawCameras = [];

      try {
        const response = await fetch('https://cctv.corp8.cloud/cameras.json', {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'GujRaksha-CCTV-Platform/1.0'
          },
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            rawCameras = Array.isArray(data) ? data : (data.cameras || []);
          } else {
            const text = await response.text();
            try {
              const parsed = JSON.parse(text);
              rawCameras = Array.isArray(parsed) ? parsed : (parsed.cameras || []);
            } catch (e) {
              console.warn('⚠️ Response from cctv.corp8.cloud was not JSON, falling back to standard list');
            }
          }
        }
      } catch (fetchErr) {
        console.warn('⚠️ Could not connect to https://cctv.corp8.cloud/cameras.json:', fetchErr.message);
      }

      // If remote API returned no list or failed, fallback to the 30 standard cameras
      if (!Array.isArray(rawCameras) || rawCameras.length === 0) {
        console.log('ℹ️ Using standard camera catalogue definitions for sync');
        rawCameras = [
          { "id": "cam01", "name": "01 Chiman bhai Bridge" },
          { "id": "cam02", "name": "02 Janpath" },
          { "id": "cam03", "name": "03 O.N.G.C. Office" },
          { "id": "cam04", "name": "04 Paldi Circle" },
          { "id": "cam05", "name": "05 Visat teen Rasta" },
          { "id": "cam06", "name": "06 Timbavadi gate-Junagadh" },
          { "id": "cam07", "name": "07 hero-showroom-gir-somnath" },
          { "id": "cam08", "name": "08 majewadi-gate-junagadh" },
          { "id": "cam09", "name": "09 new-bypass-near-by-circle-junagadh-2" },
          { "id": "cam10", "name": "10 char-chowk-road-2-junagadh" },
          { "id": "cam11", "name": "11 dolatpara-junagadh" },
          { "id": "cam12", "name": "12 Tri Mandir Adalaj Tollnaka" },
          { "id": "cam13", "name": "13 CN Vidhyalaya" },
          { "id": "cam14", "name": "14 Delight" },
          { "id": "cam15", "name": "15 Suvidha park" },
          { "id": "cam16", "name": "16 Visat P2" },
          { "id": "cam17", "name": "17 Rajkot Bus Port CCTV" },
          { "id": "cam18", "name": "18 Rajkot CCTV" },
          { "id": "cam19", "name": "19 KHAPARIA GRAM PANCHAYAT , TALUKA GANDEVI, DISTRICT NAVSARI" },
          { "id": "cam20", "name": "20 Mohanpura" },
          { "id": "cam21", "name": "23 Patan Dethali Char Rasta" },
          { "id": "cam22", "name": "28 BK Mervada tran Rasta" },
          { "id": "cam23", "name": "30 kheram" },
          { "id": "cam24", "name": "33 dehgam" },
          { "id": "cam25", "name": "34 dhanori" },
          { "id": "cam26", "name": "35 TANKAL" },
          { "id": "cam27", "name": "36 bilimora" },
          { "id": "cam28", "name": "37 bilimora" },
          { "id": "cam29", "name": "38 bilimora" },
          { "id": "cam30", "name": "Gandhidham Rambaugh p2" }
        ];
      }

      const syncedCameras = [];

      for (const cam of rawCameras) {
        const idStr = String(cam.id || '').trim();
        if (!idStr) continue;

        const camId = idStr;
        const camCode = cam.camera_code || `GJ-GOV-${camId.toUpperCase()}`;
        const locMeta = this.resolveLocationMetadata(cam.location || cam.name);
        const camType = this.resolveCameraType(camId, cam.name, cam.location);

        // Required Stream Endpoints
        const hlsUrl = `https://cctv.corp8.cloud/${camId}/index.m3u8`;
        const rtspUrl = `rtsp://103.250.160.189:8554/stream/${camId}`;
        const whepUrl = `http://103.250.160.189:8889/stream/${camId}/whep`;

        const cameraRecord = {
          id: camId,
          camera_code: camCode,
          name: cam.name || `Camera ${camId}`,
          department_id: cam.department_id || 'HOME',
          department_name: cam.department_name || 'Home Department / Gujarat Police',
          district: cam.district || locMeta.district,
          taluka: cam.taluka || locMeta.district,
          latitude: cam.latitude !== undefined ? parseFloat(cam.latitude) : locMeta.lat,
          longitude: cam.longitude !== undefined ? parseFloat(cam.longitude) : locMeta.lng,
          address: cam.address || cam.location || `${cam.name || camId}, ${locMeta.district}, Gujarat`,
          ownership_type: cam.ownership_type || 'GOVERNMENT',
          camera_type: cam.camera_type || camType,
          detection_mode: cam.detection_mode || 'GENERAL_SURVEILLANCE',
          vms_vendor: cam.vms_vendor || 'Sentinel Netra Feeder (cctv.corp8.cloud)',

          status: cam.status || (cam.live !== false ? 'ACTIVE' : 'INACTIVE'),
          stream_url: rtspUrl,
          rtsp_url: rtspUrl,
          whep_url: whepUrl,
          hls_url: hlsUrl,
          codec: (cam.codec || 'H.264').toUpperCase(),
          retention_days: parseInt(cam.retention_days || 30, 10),
          installation_date: cam.installation_date || '2026-08-25',
          stream_properties: {
            resolution: (cam.width && cam.height) ? `${cam.width}x${cam.height}` : (cam.stream_properties?.resolution || '1920x1080'),
            fps: cam.fps ? parseFloat(cam.fps) : (cam.stream_properties?.fps || 25),
            codec: (cam.codec || cam.stream_properties?.codec || 'H.264').toUpperCase(),
            bitrate: cam.bitrate_kbps ? `${cam.bitrate_kbps}Kbps` : (cam.stream_properties?.bitrate || '2000Kbps')
          },
          urls: {
            rtsp: rtspUrl,
            whep: whepUrl,
            hls: hlsUrl
          }
        };

        syncedCameras.push(cameraRecord);
      }

      // Bulk upsert into camera database (PostgreSQL + in-memory store + cameras.json)
      const added = await db.bulkCreate(syncedCameras);

      return {
        success: true,
        count: added.length,
        cameras: added
      };
    } catch (err) {
      console.error('Government live feeds sync error:', err.message);
      const existing = db.getAll({});
      return {
        success: false,
        count: existing.length,
        cameras: existing,
        error: err.message
      };
    }
  }
}

export default new OnboardingService();
