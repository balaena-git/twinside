import fs from "fs";
import path from "path";
import { UPLOADS_ROOT } from "../config.js";

const AVATARS_DIR = path.join(UPLOADS_ROOT, "avatars");
const VERIFY_DIR = path.join(UPLOADS_ROOT, "verify");
const PHOTOS_DIR = path.join(UPLOADS_ROOT, "photos");

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

export function ensureUserUploadDirs() {
  [UPLOADS_ROOT, AVATARS_DIR, VERIFY_DIR, PHOTOS_DIR].forEach(ensure);
}

ensureUserUploadDirs();

export { AVATARS_DIR, VERIFY_DIR, PHOTOS_DIR };
