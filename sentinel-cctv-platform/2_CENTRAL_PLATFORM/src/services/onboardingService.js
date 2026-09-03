import db from '../db/pool.js';
import departmentStore from '../db/departmentStore.js';

class OnboardingService {
  // Helper to parse a single CSV line with quotes support
  parseCsvRow(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' || c === "'") {
        if (inQuotes && text[i + 1] === c) {
          cur += c;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // Smart resolver: maps CSV department_key / code to registered Gujarat Department
  resolveDepartmentFromRecord(record, allDepts = []) {
    const rawKey = (record.department_key || record.dept_key || record.key || record.department_id || record.department || record.dept || record.code || '').toLowerCase().trim();
    const rawDeptName = (record.department_name || '').toLowerCase().trim();

    // 1. Direct match by department unique key / code
    if (rawKey) {
      const match = allDepts.find(d => (d.code || '').toLowerCase() === rawKey);
      if (match) return { id: match.code, name: match.name };

      // Fuzzy Key Aliases
      if (rawKey.includes('police') || rawKey.includes('home') || rawKey.includes('law')) {
        const home = allDepts.find(d => d.code === 'HOME');
        if (home) return { id: home.code, name: home.name };
      }
      if (rawKey.includes('traffic') || rawKey.includes('transport') || rawKey.includes('rto')) {
        const trans = allDepts.find(d => d.code === 'TRANSPORT');
        if (trans) return { id: trans.code, name: trans.name };
      }
      if (rawKey.includes('urban') || rawKey.includes('municip') || rawKey.includes('smart') || rawKey.includes('amc') || rawKey.includes('smc')) {
        const urban = allDepts.find(d => d.code === 'URBAN_DEV' || d.code === 'URBAN');
        if (urban) return { id: urban.code, name: urban.name };
      }
      if (rawKey.includes('forest') || rawKey.includes('wildlife')) {
        const forest = allDepts.find(d => d.code === 'FOREST');
        if (forest) return { id: forest.code, name: forest.name };
      }
      if (rawKey.includes('port') || rawKey.includes('maritime') || rawKey.includes('gmb')) {
        const port = allDepts.find(d => d.code === 'PORTS');
        if (port) return { id: port.code, name: port.name };
      }
      if (rawKey.includes('revenue') || rawKey.includes('tax') || rawKey.includes('gst')) {
        const rev = allDepts.find(d => d.code === 'REVENUE' || d.code === 'FINANCE');
        if (rev) return { id: rev.code, name: rev.name };
      }
      if (rawKey.includes('health') || rawKey.includes('hospital')) {
        const health = allDepts.find(d => d.code === 'HEALTH');
        if (health) return { id: health.code, name: health.name };
      }
      if (rawKey.includes('education') || rawKey.includes('school') || rawKey.includes('gseb')) {
        const edu = allDepts.find(d => d.code === 'EDUCATION');
        if (edu) return { id: edu.code, name: edu.name };
      }
    }

    // 2. Match by department name
    if (rawDeptName || rawKey) {
      const searchStr = rawDeptName || rawKey;
      const match = allDepts.find(d => (d.name || '').toLowerCase().includes(searchStr));
      if (match) return { id: match.code, name: match.name };
    }

    // Fallback: Default to HOME Department
    const defaultHome = allDepts.find(d => d.code === 'HOME') || { code: 'HOME', name: 'Home Department / Gujarat Police' };
    return { id: defaultHome.code, name: defaultHome.name };
  }

  async processBulkCsv(rawText) {
    if (!rawText || !rawText.trim()) {
      throw new Error('CSV file content is empty.');
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one camera data row.');
    }

    const headers = this.parseCsvRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, ''));
    const rows = lines.slice(1);
    const validCameras = [];
    const errors = [];
    const allDepts = departmentStore.departments || [];

    for (let index = 0; index < rows.length; index++) {
      const line = rows[index];
      const parts = this.parseCsvRow(line);
      if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

      const record = {};
      headers.forEach((h, idx) => {
        record[h] = parts[idx] !== undefined ? parts[idx].replace(/^["']|["']$/g, '').trim() : '';
      });

      const name = record.name || record.camera_name || record.location || `Camera-${index + 1}`;
      const latRaw = record.latitude !== undefined && record.latitude !== '' ? record.latitude : (record.lat || record.gps_lat || record.latitude_gps);
      const lngRaw = record.longitude !== undefined && record.longitude !== '' ? record.longitude : (record.lng || record.lon || record.gps_lng || record.longitude_gps);

      const lat = parseFloat(latRaw);
      const lng = parseFloat(lngRaw);

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        errors.push(`Row ${index + 2}: Invalid GPS coordinates (Lat: ${latRaw || 'empty'}, Lng: ${lngRaw || 'empty'}). Valid Latitude (-90 to 90) and Longitude (-180 to 180) are required.`);
        continue;
      }

      // Department & Category resolution
      const resolvedDept = this.resolveDepartmentFromRecord(record, allDepts);
      const dept = resolvedDept.id;
      const deptName = record.department_name || resolvedDept.name;
      const district = record.district || record.city || 'Ahmedabad';
      const cameraCode = record.camera_code || record.code || record.asset_code || `GJ-${district.substring(0, 3).toUpperCase()}-CAM-${Date.now().toString().slice(-4)}${index + 1}`;

      // Detection Mode normalization (Default: GENERAL_SURVEILLANCE / No ANPR)
      let detectionMode = (record.detection_mode || record.ai_mode || record.mode || record.anpr_mode || record.detection || 'GENERAL_SURVEILLANCE').toUpperCase().trim();
      if (detectionMode === 'ANPR' || detectionMode === 'TRUE' || detectionMode === 'YES' || detectionMode === '1' || detectionMode === 'ANPR_DETECTION' || detectionMode.includes('ANPR')) {
        detectionMode = 'ANPR_DETECTION';
      } else {
        detectionMode = 'GENERAL_SURVEILLANCE';
      }

      // Camera Type normalization
      let camType = (record.camera_type || record.type || record.hardware_type || 'PTZ').toUpperCase().trim();
      if (camType.includes('ANPR')) camType = 'ANPR_SPECIAL';
      else if (camType.includes('BULLET') || camType.includes('FIXED')) camType = 'FIXED_BULLET';
      else if (camType.includes('DOME')) camType = 'DOME_INDOOR';
      else if (camType.includes('PTZ') || camType.includes('SPEED')) camType = 'PTZ';
      else camType = 'PTZ';

      // Stream URLs (RTSP for backend/AI, WHEP/WebRTC & HLS for browser playback)
      const host = '103.250.160.189';
      const cleanId = (record.camera_code || cameraCode).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || `cam-${index + 1}`;
      let rtspUrl = (record.rtsp_url || record.rtsp || '').trim();
      let whepUrl = (record.whep_url || record.whep || '').trim();
      let hlsUrl = (record.hls_url || record.hls || '').trim();
      let streamUrl = (record.stream_url || record.url || record.stream || record.feed_url || '').trim();

      // Auto-populate missing stream formats if only one format was provided
      if (rtspUrl && !whepUrl) {
        whepUrl = rtspUrl.includes('103.250.160.189')
          ? `http://103.250.160.189:8889/stream/${cleanId}/whep`
          : `http://${host}:8889/stream/${cleanId}/whep`;
      }
      if (rtspUrl && !hlsUrl) {
        hlsUrl = rtspUrl.includes('103.250.160.189')
          ? `https://cctv.corp8.cloud/${cleanId}/index.m3u8`
          : `http://${host}:8888/stream/${cleanId}/index.m3u8`;
      }

      if (whepUrl && !rtspUrl) {
        rtspUrl = `rtsp://${host}:8554/stream/${cleanId}`;
      }
      if (hlsUrl && !whepUrl) {
        whepUrl = `http://${host}:8889/stream/${cleanId}/whep`;
      }

      if (!streamUrl) {
        streamUrl = rtspUrl || whepUrl || hlsUrl;
      }

      validCameras.push({
        name: name.trim(),
        camera_code: cameraCode.trim(),
        department_id: dept,
        department_name: deptName,
        district: district.trim(),
        taluka: (record.taluka || record.area || record.zone || '').trim(),
        latitude: lat,
        longitude: lng,
        address: (record.address || record.landmark || `${name}, ${district}, Gujarat`).trim(),
        ownership_type: (record.ownership_type || record.ownership || 'GOVERNMENT').toUpperCase().trim(),
        camera_type: camType,
        detection_mode: detectionMode,
        vms_vendor: record.vms_vendor || record.vendor || 'Live Sentinel Feeder',
        status: (record.status || 'ACTIVE').toUpperCase().trim(),
        stream_url: streamUrl,
        rtsp_url: rtspUrl,
        whep_url: whepUrl,
        hls_url: hlsUrl,
        codec: (record.codec || 'H.264').toUpperCase().trim(),
        retention_days: parseInt(record.retention_days || 15, 10) || 15,
        resolution: record.resolution || '1920x1080',
        fps: parseInt(record.fps || 30, 10) || 30,
        bitrate: record.bitrate || '4Mbps'
      });
    }

    if (validCameras.length === 0) {
      throw new Error(`No valid camera rows found in CSV. ${errors.length > 0 ? errors.slice(0, 3).join('; ') : ''}`);
    }

    const added = await db.bulkCreate(validCameras);

    return {
      successCount: added.length,
      errorCount: errors.length,
      errors: errors,
      onboardedCameras: added
    };
  }

  getSampleCsvTemplate() {
    return `name,camera_code,department_key,district,taluka,latitude,longitude,address,camera_type,rtsp_url,whep_url,hls_url
"01 Chiman bhai Bridge, Ahmedabad",GJ-AMD-CAM-001,HOME,Ahmedabad,City,23.0225,72.5714,"Near Ellis Bridge, Ashram Road",PTZ,rtsp://103.250.160.189:8554/stream/cam01,http://103.250.160.189:8889/stream/cam01/whep,https://cctv.corp8.cloud/cam01/index.m3u8
"02 Janpath Crossing, Ahmedabad",GJ-AMD-CAM-002,TRANSPORT,Ahmedabad,City,23.0335,72.5850,"Janpath Hotel Circle, Ashram Road",PTZ,rtsp://103.250.160.189:8554/stream/cam02,http://103.250.160.189:8889/stream/cam02/whep,https://cctv.corp8.cloud/cam02/index.m3u8
"03 Paldi Circle Junction",GJ-AMD-CAM-003,URBAN_DEV,Ahmedabad,Paldi,23.0125,72.5620,"Paldi Cross Roads, Ahmedabad",FIXED_BULLET,rtsp://103.250.160.189:8554/stream/cam04,http://103.250.160.189:8889/stream/cam04/whep,https://cctv.corp8.cloud/cam04/index.m3u8
"04 Tri Mandir Adalaj Tollnaka",GJ-GND-CAM-004,HOME,Gandhinagar,Adalaj,23.1678,72.5812,"SH-41 Highway, Adalaj Toll Plaza",ANPR_SPECIAL,rtsp://103.250.160.189:8554/stream/cam12,http://103.250.160.189:8889/stream/cam12/whep,https://cctv.corp8.cloud/cam12/index.m3u8
"05 Surat Dumas Road Checkpost",GJ-SRT-CAM-005,HOME,Surat,Choryasi,21.1500,72.7800,"Dumas Road Police Checkpost, Surat",DOME_INDOOR,rtsp://103.250.160.189:8554/stream/cam05,http://103.250.160.189:8889/stream/cam05/whep,https://cctv.corp8.cloud/cam05/index.m3u8`;
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
        const existing = db.getById(camId) || db.getByCameraCode(camCode);
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
          department_id: cam.department_id || (existing ? existing.department_id : 'HOME'),
          department_name: cam.department_name || (existing ? existing.department_name : 'Home Department / Gujarat Police'),
          district: cam.district || (existing ? existing.district : locMeta.district),
          taluka: cam.taluka || (existing ? existing.taluka : locMeta.district),
          latitude: cam.latitude !== undefined ? parseFloat(cam.latitude) : (existing ? existing.latitude : locMeta.lat),
          longitude: cam.longitude !== undefined ? parseFloat(cam.longitude) : (existing ? existing.longitude : locMeta.lng),
          address: cam.address || cam.location || (existing ? existing.address : `${cam.name || camId}, ${locMeta.district}, Gujarat`),
          ownership_type: cam.ownership_type || (existing ? existing.ownership_type : 'GOVERNMENT'),
          camera_type: cam.camera_type || (existing ? existing.camera_type : camType),
          detection_mode: (cam.detection_mode && cam.detection_mode !== 'GENERAL_SURVEILLANCE')
            ? cam.detection_mode
            : (existing ? (existing.detection_mode || 'GENERAL_SURVEILLANCE') : (cam.detection_mode || 'GENERAL_SURVEILLANCE')),
          vms_vendor: cam.vms_vendor || (existing ? existing.vms_vendor : 'Sentinel Netra Feeder (cctv.corp8.cloud)'),

          status: cam.status || (existing ? existing.status : (cam.live !== false ? 'ACTIVE' : 'INACTIVE')),
          stream_url: rtspUrl,
          rtsp_url: rtspUrl,
          whep_url: whepUrl,
          hls_url: hlsUrl,
          codec: (cam.codec || (existing ? existing.codec : 'H.264')).toUpperCase(),
          retention_days: parseInt(cam.retention_days || (existing ? existing.retention_days : 30), 10),
          installation_date: cam.installation_date || (existing ? existing.installation_date : '2026-08-25'),
          stream_properties: {
            resolution: (cam.width && cam.height) ? `${cam.width}x${cam.height}` : (cam.stream_properties?.resolution || existing?.stream_properties?.resolution || '1920x1080'),
            fps: cam.fps ? parseFloat(cam.fps) : (cam.stream_properties?.fps || existing?.stream_properties?.fps || 25),
            codec: (cam.codec || cam.stream_properties?.codec || existing?.stream_properties?.codec || 'H.264').toUpperCase(),
            bitrate: cam.bitrate_kbps ? `${cam.bitrate_kbps}Kbps` : (cam.stream_properties?.bitrate || existing?.stream_properties?.bitrate || '2000Kbps')
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
