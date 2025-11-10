import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3000', 10);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env variable must be set');
}

const SESSION_SECRET = process.env.SESSION_SECRET || JWT_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET env variable must be set');
}

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || NODE_ENV === 'production';
const SAME_SITE = COOKIE_SECURE ? 'none' : 'lax';

const BACKEND_ROOT = path.join(__dirname, '..');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
let defaultFrom = 'TwinSide <no-reply@twinside.local>';
try {
  const { hostname } = new URL(APP_URL);
  if (hostname) {
    defaultFrom = `TwinSide <no-reply@${hostname}>`;
  }
} catch (_err) {
  // keep fallback default
}

const SMTP_FROM = process.env.SMTP_FROM || defaultFrom;

export {
  NODE_ENV,
  PORT,
  APP_URL,
  JWT_SECRET,
  SESSION_SECRET,
  COOKIE_SECURE,
  SAME_SITE,
  BACKEND_ROOT,
  UPLOADS_ROOT,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
};
