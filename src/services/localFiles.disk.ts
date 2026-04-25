// src/services/localFiles.disk.ts
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { extension as mimeExtension } from 'mime-types';
import type { Express } from 'express';
import { env } from '../config/env';

export const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

// (https://api.mishkat.academy)
const BASE_URL = env.APP_BASE_URL.replace(/\/+$/, '');

function yyyymm(d: Date = new Date()) {
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { y, m };
}

/**
 * اسم آمن وقصير من الاسم الأصلي:
 * - يشيل الامتداد
 * - يمنع الحروف الغريبة
 * - يستبدلها بـ '_' ويقص لحد 64 حرف
 */
function safeBaseName(name: string) {
  const base = (name || 'file').replace(/\.[^./\\]+$/, '');
  const cleaned = base.replace(/[^\w.\-]+/g, '_').slice(0, 64);
  return cleaned || 'file';
}

/**
 * اختيار الامتداد:
 * - الأولوية للـ MIME
 * - لو مش واضح ناخد الامتداد من الاسم الأصلي لو موجود
 */
function pickExt(originalName: string, mimeType?: string) {
  const fromMime = mimeExtension(mimeType || '') || '';
  if (fromMime) return `.${fromMime}`;
  const ext = path.extname(originalName || '').toLowerCase();
  return ext || '';
}

async function sha1OfFile(filePath: string) {
  const hash = crypto.createHash('sha1');
  const fh = await fs.open(filePath, 'r');
  const stream = fh.createReadStream();

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  }).finally(() => fh.close());

  return hash.digest('hex').slice(0, 16);
}

export interface StoredFileInfo {
  url: string; // رابط عام: APP_BASE_URL + /uploads/...
  relPath: string; // مسار نسبي داخل uploads (يُخزن في الـ DB)
  absPath: string; // مسار مطلق على القرص (لا يُخزن في الـ DB)
  filename: string;
  size: number;
  mime?: string;
}

/**
 * ينقل ملف من uploads_tmp (أو أي temp path) إلى:
 * uploads/<folder>/<year>/<month>/<hash>-<slug>.<ext>
 *
 * مثال:
 *   moveDiskFileToUploads(file, 'public/avatars')
 *   moveDiskFileToUploads(file, `private/research/${userId}/${requestId}`)
 */
export async function moveDiskFileToUploads(
  file: Express.Multer.File,
  folder: string,
): Promise<StoredFileInfo> {
  const { y, m } = yyyymm();
  const relDir = path.join(folder, y, m);
  const absDir = path.join(UPLOAD_ROOT, relDir);

  await fs.mkdir(absDir, { recursive: true });

  const hash = await sha1OfFile(file.path);
  const base = safeBaseName(file.originalname);
  const ext = pickExt(file.originalname, file.mimetype);
  const filename = `${hash}-${base}${ext}`;

  const finalAbs = path.join(absDir, filename);

  try {
    await fs.rename(file.path, finalAbs);
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      await fs.copyFile(file.path, finalAbs);
      await fs.unlink(file.path);
    } else {
      throw err;
    }
  }

  const relPath = path.join(relDir, filename).replace(/\\/g, '/');
  const url = `${BASE_URL}/uploads/${relPath}`;

  const stat = await fs.stat(finalAbs);

  return {
    url,
    relPath,
    absPath: finalAbs,
    filename,
    size: stat.size,
    mime: file.mimetype,
  };
}

export function getAbsolutePath(relPath: string) {
  return path.join(UPLOAD_ROOT, relPath);
}

/** حذف ملف محليًا عبر relPath (لو مش موجود يتجاهل في هدوء) */
export async function deleteLocalByRelPath(relPath?: string | null) {
  if (!relPath) return;
  const abs = path.join(UPLOAD_ROOT, relPath);
  try {
    await fs.unlink(abs);
  } catch {}
}
