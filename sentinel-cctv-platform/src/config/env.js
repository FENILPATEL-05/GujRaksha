import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: process.env.DB_PORT || 5432,
    NAME: process.env.DB_NAME || 'sentinel_cctv_db',
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'postgres',
  },
  JWT_SECRET: process.env.JWT_SECRET || 'sentinel-gujarat-police-secret-key-2026',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'sentinel-aes256-secret-encryption-key-32b',
  DATA_PATH: path.join(__dirname, '../data/sample_cameras.json')
};
