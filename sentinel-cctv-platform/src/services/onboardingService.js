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
      // Use local registry as primary authoritative source
      const existing = db.getAll({});
      return {
        success: true,
        count: existing.length,
        cameras: existing
      };
    } catch (err) {
      console.error('Government live feeds sync error:', err.message);
      return {
        success: false,
        count: 0,
        cameras: []
      };
    }
  }
}

export default new OnboardingService();
