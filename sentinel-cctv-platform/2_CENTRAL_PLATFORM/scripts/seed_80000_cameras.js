import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const CAMERAS_JSON_PATH = path.join(DATA_DIR, 'cameras.json');

const DISTRICT_SPECS = [
  { district: "Ahmedabad", lat: 23.0225, lng: 72.5714, targetCount: 12000, talukas: ["Ahmedabad City", "Daskroi", "Sanand", "Dholka", "Viramgam", "Bavla", "Dhandhuka", "Mandal", "Detroj-Rampura"] },
  { district: "Surat", lat: 21.1702, lng: 72.8311, targetCount: 10000, talukas: ["Surat City", "Chorasi", "Olpad", "Bardoli", "Kamrej", "Palsana", "Mahuva", "Mandvi", "Mangrol", "Umarpada"] },
  { district: "Vadodara", lat: 22.3072, lng: 73.1812, targetCount: 7000, talukas: ["Vadodara Urban", "Padra", "Savli", "Karjan", "Waghodia", "Dabhoi", "Sinor", "Desar"] },
  { district: "Rajkot", lat: 22.3039, lng: 70.8022, targetCount: 6500, talukas: ["Rajkot Urban", "Gondal", "Kotda Sangani", "Jasdan", "Dhoraji", "Jetpur", "Upleta", "Lodhika", "Paddhari", "Vinchhiya", "Jamkandorna"] },
  { district: "Gandhinagar", lat: 23.2156, lng: 72.6369, targetCount: 4000, talukas: ["Gandhinagar City", "Kalol", "Dehgam", "Mansa"] },
  { district: "Kutch", lat: 23.242, lng: 69.6669, targetCount: 3500, talukas: ["Bhuj", "Gandhidham", "Anjar", "Mundra", "Mandvi", "Nakhatrana", "Abdasa", "Lakhpat", "Rapar", "Bhachau"] },
  { district: "Bhavnagar", lat: 21.7645, lng: 72.1519, targetCount: 3000, talukas: ["Bhavnagar Urban", "Sihor", "Palitana", "Talaja", "Mahuva", "Gariadhar", "Umrala", "Vallabhipur", "Jesar", "Ghogha"] },
  { district: "Jamnagar", lat: 22.4707, lng: 70.0577, targetCount: 2800, talukas: ["Jamnagar Urban", "Lalpur", "Kalavad", "Jamjodhpur", "Jodiya", "Dhrol"] },
  { district: "Bharuch", lat: 21.7051, lng: 72.9959, targetCount: 2500, talukas: ["Bharuch City", "Ankleshwar", "Jambusar", "Hansot", "Vagra", "Amod", "Valia", "Jhagadia", "Netrang"] },
  { district: "Junagadh", lat: 21.5222, lng: 70.4579, targetCount: 2200, talukas: ["Junagadh City", "Keshod", "Mangrol", "Manavadar", "Visavadar", "Malia Hatina", "Vanthali", "Mendarda", "Bhesan"] },
  { district: "Morbi", lat: 22.812, lng: 70.8385, targetCount: 2200, talukas: ["Morbi Urban", "Wankaner", "Halvad", "Tankara", "Maliya"] },
  { district: "Mehsana", lat: 23.588, lng: 72.3693, targetCount: 2000, talukas: ["Mehsana City", "Kadi", "Visnagar", "Unjha", "Vadnagar", "Vijapur", "Kheralu", "Satlasana", "Jotana", "Gojariya"] },
  { district: "Banaskantha", lat: 24.1724, lng: 72.4346, targetCount: 1800, talukas: ["Palanpur", "Deesa", "Dhanera", "Tharad", "Vav", "Danta", "Amirgadh", "Vadgam", "Bhabhar", "Kankrej", "Deodar", "Suigam"] },
  { district: "Anand", lat: 22.5645, lng: 72.9289, targetCount: 1800, talukas: ["Anand Urban", "Petlad", "Borsad", "Khambhat", "Umreth", "Sojitra", "Tarapur", "Anklav"] },
  { district: "Kheda", lat: 22.7533, lng: 72.6844, targetCount: 1700, talukas: ["Nadiad", "Kheda", "Matar", "Mehmedabad", "Mahudha", "Kapadvanj", "Kathlal", "Thasra", "Galteshwar", "Vaso"] },
  { district: "Panchmahal", lat: 22.7756, lng: 73.6149, targetCount: 1500, talukas: ["Godhra", "Halol", "Kalol", "Shehra", "Ghoghamba", "Jambughoda", "Morwa Hadaf"] },
  { district: "Surendranagar", lat: 22.7275, lng: 71.6375, targetCount: 1500, talukas: ["Wadhwan", "Dhrangadhra", "Limbdi", "Chotila", "Sayla", "Dasada", "Lakhtar", "Muli", "Thangadh", "Chuda"] },
  { district: "Navsari", lat: 20.9467, lng: 72.952, targetCount: 1400, talukas: ["Navsari City", "Jalalpore", "Gandevi", "Chikhli", "Vansda", "Khergam"] },
  { district: "Valsad", lat: 20.5992, lng: 72.9342, targetCount: 1400, talukas: ["Valsad Urban", "Vapi", "Pardi", "Umbergaon", "Dharampur", "Kaprada"] },
  { district: "Sabarkantha", lat: 23.5977, lng: 73.0645, targetCount: 1300, talukas: ["Himatnagar", "Idar", "Prantij", "Talod", "Khedbrahma", "Vadali", "Vijaynagar", "Poshina"] },
  { district: "Amreli", lat: 21.6032, lng: 71.2221, targetCount: 1200, talukas: ["Amreli Urban", "Dhari", "Babra", "Savarkundla", "Rajula", "Jafrabad", "Khambha", "Lathi", "Lilia", "Bagasara", "Kunkavav Vadia"] },
  { district: "Gir Somnath", lat: 20.9042, lng: 70.3667, targetCount: 1200, talukas: ["Veraval", "Patan-Somnath", "Kodinar", "Una", "Talala", "Sutrapada", "Gir Gadhada"] },
  { district: "Dahod", lat: 22.8398, lng: 74.2546, targetCount: 1100, talukas: ["Dahod City", "Jhalod", "Limkheda", "Garbada", "Devgadh Baria", "Fatepura", "Dhanpur", "Sanjeli", "Singvad"] },
  { district: "Patan", lat: 23.8493, lng: 72.1266, targetCount: 1100, talukas: ["Patan City", "Sidhpur", "Chanasma", "Radhanpur", "Sami", "Harij", "Santalpur", "Shankheshwar", "Saraswati"] },
  { district: "Aravalli", lat: 23.4608, lng: 73.3235, targetCount: 1000, talukas: ["Modasa", "Malpur", "Bayad", "Dhansura", "Meghraj", "Bhiloda"] },
  { district: "Devbhoomi Dwarka", lat: 22.2442, lng: 68.9685, targetCount: 1000, talukas: ["Dwarka", "Khambhalia", "Kalyanpur", "Bhanvad"] },
  { district: "Porbandar", lat: 21.6417, lng: 69.6293, targetCount: 900, talukas: ["Porbandar Urban", "Ranavav", "Kutiyana"] },
  { district: "Botad", lat: 22.1704, lng: 71.6664, targetCount: 900, talukas: ["Botad Urban", "Gadhada", "Barwala", "Ranpur"] },
  { district: "Mahisagar", lat: 23.1432, lng: 73.6166, targetCount: 800, talukas: ["Lunawada", "Santrampur", "Kadana", "Virpur", "Balasinor", "Khanpur"] },
  { district: "Narmada", lat: 21.8711, lng: 73.5042, targetCount: 800, talukas: ["Rajpipla", "Nandod", "Garudeshwar (Statue of Unity)", "Tilakwada", "Dediapada", "Sagbara"] },
  { district: "Chhota Udaipur", lat: 22.3081, lng: 74.0125, targetCount: 700, talukas: ["Chhota Udaipur", "Bodeli", "Jetpur Pavi", "Nasvadi", "Sankheda", "Kavant"] },
  { district: "Tapi", lat: 21.2562, lng: 73.3986, targetCount: 600, talukas: ["Vyara", "Songadh", "Valod", "Uchchhal", "Nizar", "Kukarmunda", "Dolvan"] },
  { district: "Dang", lat: 20.7533, lng: 73.7027, targetCount: 500, talukas: ["Ahwa", "Saputara", "Waghai", "Subir"] }
];

const DEPARTMENTS = [
  { id: "HOME", name: "Home Department / Gujarat Police", weight: 35 },
  { id: "TRANSPORT", name: "Transport Department / RTO Gujarat", weight: 14 },
  { id: "URBAN_DEV", name: "Urban Development & Smart Cities", weight: 12 },
  { id: "ROADS_BUILDINGS", name: "Roads & Buildings / State Highways", weight: 10 },
  { id: "PORTS", name: "Gujarat Maritime Board & Ports", weight: 4 },
  { id: "HEALTH", name: "Health & Family Welfare (Civil Hospitals)", weight: 4 },
  { id: "EDUCATION", name: "Education (Universities & Schools)", weight: 3 },
  { id: "FOREST_ENV", name: "Forest & Environment (Sanctuaries)", weight: 3 },
  { id: "ENERGY_PETRO", name: "Energy & Petrochemicals (GETCO/Grid)", weight: 3 },
  { id: "CIVIL_SUPPLIES", name: "Food & Civil Supplies (Godowns)", weight: 2 },
  { id: "REVENUE", name: "Revenue (Collectorates & Land Records)", weight: 2 },
  { id: "TOURISM", name: "Gujarat Tourism & Pilgrimage Sites", weight: 2 },
  { id: "WATER_RES", name: "Water Resources (Dams & Canals)", weight: 2 },
  { id: "MINES_MINERALS", name: "Geology & Mining Checkposts", weight: 2 },
  { id: "PANCHAYAT", name: "Panchayat & Rural Development", weight: 1 },
  { id: "LABOUR_EMP", name: "Labour & Employment (Industrial Safety)", weight: 1 }
];

const CAMERA_TYPES = [
  { type: "PTZ", weight: 35 },
  { type: "BULLET", weight: 30 },
  { type: "DOME", weight: 20 },
  { type: "ANPR_SPECIAL", weight: 12 },
  { type: "360_PANORAMIC", weight: 3 }
];

const DETECTION_MODES = [
  { mode: "TRAFFIC_MONITORING", weight: 50 },
  { mode: "RED_LIGHT_VIOLATION", weight: 20 },
  { mode: "PERIMETER_SECURITY", weight: 20 },
  { mode: "SPEED_DETECTION", weight: 10 }
];

const VENDORS = [
  "Hikvision DarkFighter CCC",
  "Dahua AI WizMind Sensor",
  "Axis Communications Q-Series",
  "CP PLUS Coral High-Speed PTZ",
  "Hanwha Wisenet AI Matrix",
  "Honeywell Enterprise CCC",
  "Bosch Security Dinion HD",
  "Live Sentinel Feeder (H264/MP4)"
];

const ROAD_PREFIXES = [
  "National Highway NH-48",
  "State Highway SH-41",
  "State Highway SH-17",
  "Outer Ring Road",
  "Inner Ring Road",
  "Main Market Crossroads",
  "Station Road Junction",
  "GIDC Industrial Area Gate",
  "APMC Market Yard Toll",
  "Civil Hospital Approach",
  "Bus Terminal Entry Gate",
  "Police Checkpost Corridor",
  "Flyover Approach Ramp",
  "Canal Road Intersection",
  "Expressway Exit Interchange"
];

function pickWeighted(items) {
  const total = items.reduce((acc, it) => acc + (it.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= (it.weight || 1);
    if (r <= 0) return it;
  }
  return items[0];
}

function generate80000Cameras() {
  console.log('🔄 Loading existing live cameras (1-30)...');
  let baseCameras = [];
  if (fs.existsSync(CAMERAS_JSON_PATH)) {
    try {
      const raw = fs.readFileSync(CAMERAS_JSON_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        baseCameras = parsed.slice(0, 30);
      }
    } catch (e) {}
  }

  const existingCount = baseCameras.length;
  const TOTAL_TARGET = 80000;
  const needed = TOTAL_TARGET - existingCount;

  console.log(`🚀 Generating ${needed} high-density cameras across 33 Gujarat Districts...`);

  const specSum = DISTRICT_SPECS.reduce((acc, s) => acc + s.targetCount, 0);
  const scale = needed / specSum;

  const generatedCameras = [...baseCameras];
  let camCounter = existingCount + 1;

  for (const spec of DISTRICT_SPECS) {
    const districtTarget = Math.round(spec.targetCount * scale);

    for (let i = 0; i < districtTarget && generatedCameras.length < TOTAL_TARGET; i++) {
      const id = `gov-feed-${camCounter}`;
      const code = `GJ-GOV-${String(camCounter).padStart(5, '0')}`;
      
      const dept = pickWeighted(DEPARTMENTS);
      const camType = pickWeighted(CAMERA_TYPES).type;
      const detectMode = pickWeighted(DETECTION_MODES).mode;
      const vendor = VENDORS[Math.floor(Math.random() * VENDORS.length)];
      const taluka = spec.talukas[Math.floor(Math.random() * spec.talukas.length)];
      const roadPrefix = ROAD_PREFIXES[Math.floor(Math.random() * ROAD_PREFIXES.length)];

      // Gaussian-distributed spatial jitter around district center (radius ~ 2km to 15km)
      const u1 = Math.random();
      const u2 = Math.random();
      const randStd = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const latJitter = (randStd * 0.045) + (Math.random() - 0.5) * 0.04;
      const lngJitter = (randStd * 0.045) + (Math.random() - 0.5) * 0.04;

      const lat = parseFloat((spec.lat + latJitter).toFixed(6));
      const lng = parseFloat((spec.lng + lngJitter).toFixed(6));

      const status = Math.random() < 0.93 ? "ACTIVE" : (Math.random() < 0.7 ? "OFFLINE" : "MAINTENANCE");

      const name = `${spec.district} - ${roadPrefix} #${(i % 50) + 1}`;
      const address = `${roadPrefix}, ${taluka} Taluka, ${spec.district} District, Gujarat`;

      generatedCameras.push({
        id,
        camera_code: code,
        name,
        department_id: dept.id,
        department_name: dept.name,
        district: spec.district,
        taluka,
        latitude: lat,
        longitude: lng,
        address,
        ownership_type: "GOVERNMENT",
        camera_type: camType,
        detection_mode: detectMode,
        vms_vendor: vendor,
        stream_url: `rtsp://localhost:8554/stream/${camCounter}`,
        rtsp_url: `rtsp://localhost:8554/stream/${camCounter}`,
        whep_url: `http://localhost:8889/stream/${camCounter}/whep`,
        hls_url: `http://localhost:8888/stream/${camCounter}/index.m3u8`,
        codec: "H.264",
        retention_days: 30,
        status,
        installation_date: "2026-01-15",
        stream_properties: {
          resolution: "1920x1080",
          fps: 30,
          codec: "H.264",
          bitrate: "4Mbps"
        },
        urls: {
          rtsp: `rtsp://localhost:8554/stream/${camCounter}`,
          whep: `http://localhost:8889/stream/${camCounter}/whep`,
          hls: `http://localhost:8888/stream/${camCounter}/index.m3u8`
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      camCounter++;
    }
  }

  // Ensure 100% unique IDs across all 80,000 cameras
  const uniqueMap = new Map();
  generatedCameras.forEach((c, idx) => {
    const cleanId = `gov-feed-${idx + 1}`;
    const cleanCode = `GJ-GOV-${String(idx + 1).padStart(5, '0')}`;
    c.id = cleanId;
    c.camera_code = cleanCode;
    uniqueMap.set(cleanId, c);
  });

  const finalCameras = Array.from(uniqueMap.values());
  console.log(`✅ Generated exactly ${finalCameras.length} unique cameras!`);

  console.log(`💾 Writing to ${CAMERAS_JSON_PATH}...`);
  fs.writeFileSync(CAMERAS_JSON_PATH, JSON.stringify(finalCameras, null, 2), 'utf8');
  console.log('✅ File successfully persisted!');

  return finalCameras;
}

async function syncToPostgres(cameras) {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sentinel_cctv_db';
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('🐘 Connected to PostgreSQL! Syncing 80,000 cameras in high-speed batches...');

    // Clear existing to avoid conflict in bulk chunks
    await client.query('TRUNCATE TABLE cameras');

    const CHUNK_SIZE = 2000;
    const total = cameras.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = cameras.slice(i, i + CHUNK_SIZE);
      const values = [];
      const placeholders = [];

      chunk.forEach((c, idx) => {
        const offset = idx * 24;
        placeholders.push(`(
          $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7},
          $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13},
          $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20},
          $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, NOW(), NOW()
        )`);

        values.push(
          c.id, c.camera_code, c.name, c.department_id, c.department_name,
          c.district, c.taluka || '', c.latitude, c.longitude, c.address || '',
          c.ownership_type || 'GOVERNMENT', c.camera_type || 'PTZ', c.detection_mode || 'TRAFFIC_MONITORING',
          c.vms_vendor || 'Live Sentinel Feeder', c.stream_url || '', c.rtsp_url || '',
          c.whep_url || '', c.hls_url || '', c.codec || 'H.264', c.retention_days || 30,
          c.status || 'ACTIVE', c.installation_date || '2026-01-15',
          JSON.stringify(c.stream_properties || {}), JSON.stringify(c.urls || {})
        );
      });

      const sql = `
        INSERT INTO cameras (
          id, camera_code, name, department_id, department_name, district, taluka,
          latitude, longitude, address, ownership_type, camera_type, detection_mode,
          vms_vendor, stream_url, rtsp_url, whep_url, hls_url, codec, retention_days,
          status, installation_date, stream_properties, urls, created_at, updated_at
        ) VALUES ${placeholders.join(',\n')}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          camera_code = EXCLUDED.camera_code,
          department_id = EXCLUDED.department_id,
          department_name = EXCLUDED.department_name,
          district = EXCLUDED.district,
          taluka = EXCLUDED.taluka,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;

      await client.query(sql, values);
      process.stdout.write(`\r  ⚡ Progress: ${Math.min(i + CHUNK_SIZE, total)} / ${total} cameras synced to PostgreSQL...`);
    }

    console.log('\n✅ 80,000 Cameras successfully synced into PostgreSQL database!');
  } catch (err) {
    console.warn('\n⚠️ PostgreSQL sync skipped/fallback to file:', err.message);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

async function main() {
  const cameras = generate80000Cameras();
  await syncToPostgres(cameras);
  console.log('\n🎉 ALL 80,000 CAMERAS SUCCESSFULLY GENERATED & SEEDED!');
}

main().catch(err => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
