// src/middlewares/upload.disk.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { RequestHandler } from 'express';

/* =======================
 * MIME Groups
 * ======================= */
export const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
export const PDF_MIME = new Set(['application/pdf']);
export const DOC_MIME = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]);

/* =======================
 * إعداد مجلد الـ temp
 * ======================= */
const TEMP_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads_tmp');
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

type FieldMode = 'single' | 'array';

export interface FieldRule {
  name: string;
  mode: FieldMode;
  maxCount?: number;
  maxSizeMB?: number; // حد لكل ملف في هذا الحقل
  allowed: Set<string>; // MIME types المسموح بها
}

export interface UploaderConfig {
  fields: FieldRule[];
  globalMaxFiles?: number;  // حد عام لعدد الملفات في الـ request
  globalMaxSizeMB?: number; // حد عام لحجم الملف الواحد عند مستوى Multer
}

const bytes = (mb: number) => Math.floor(mb * 1024 * 1024);

/**
 * ميدل وير عام:
 * - يرفع على القرص في uploads_tmp
 * - يتحقق من:
 *   - أسماء الحقول (field names)
 *   - MIME types المسموحة
 *   - الحد الأقصى للحجم (global + per-field)
 *   - الحد الأقصى لعدد الملفات
 */
export function makeDiskUploadParser(cfg: UploaderConfig): RequestHandler {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  });

  const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    const rule = cfg.fields.find((f) => f.name === file.fieldname);
    if (!rule) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
    if (!rule.allowed.has(file.mimetype)) {
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
      (err as any).message = `نوع الملف غير مسموح لهذا الحقل (${file.fieldname}): ${file.mimetype}`;
      return cb(err);
    }
    cb(null, true);
  };

  const totalMaxFiles =
    cfg.globalMaxFiles ??
    cfg.fields.reduce((acc, f) => acc + (f.mode === 'single' ? 1 : (f.maxCount ?? 5)), 0);

  const maxFieldMBFromRules = Math.max(
    ...cfg.fields.map((f) => Math.max(1, Math.floor(f.maxSizeMB ?? 10))),
  );
  const globalMaxSizeMB = Math.max(cfg.globalMaxSizeMB ?? 0, maxFieldMBFromRules);

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      files: totalMaxFiles,
      fileSize: bytes(globalMaxSizeMB),
    },
  });

  const spec = cfg.fields.map((f) => ({
    name: f.name,
    maxCount: f.mode === 'single' ? 1 : (f.maxCount ?? 5),
  }));
  const parse = upload.fields(spec);

  // Post-validate: التحقق من maxSizeMB لكل حقل بدقة
  const postValidate: RequestHandler = (req, _res, next) => {
    const filesByField = (req.files || {}) as Record<string, Express.Multer.File[]>;

    try {
      for (const rule of cfg.fields) {
        const files = filesByField[rule.name] || [];
        if (rule.maxSizeMB) {
          const maxB = bytes(rule.maxSizeMB);
          for (const f of files) {
            if (typeof f.size === 'number' && f.size > maxB) {
              const err = new multer.MulterError('LIMIT_FILE_SIZE', rule.name);
              (err as any).message = `حجم الملف ${f.originalname} أكبر من ${rule.maxSizeMB}MB`;
              throw err;
            }
          }
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  };

  // Compose: parse → postValidate
  return (req, res, next) =>
    parse(req, res, (err?: any) => (err ? next(err) : postValidate(req, res, next)));
}

/* =======================
 * Ready-made uploaders
 * ======================= */

/**
 * Avatar:
 * - field: avatar
 * - نوع: صورة واحدة
 * - الحجم: max 5MB
 * - المرحلة دي بس في uploads_tmp (التخزين النهائي هيتم في controller عن طريق moveDiskFileToUploads)
 */
export const uploadAvatarDisk = makeDiskUploadParser({
  fields: [{ name: 'avatar', mode: 'single', allowed: IMAGE_MIME, maxSizeMB: 5 }],
  globalMaxSizeMB: 6,
});

/**
 * كتاب (PDF + cover):
 * - pdf: 100MB
 * - cover: 5MB
 */
export const uploadBookAssetsDisk = makeDiskUploadParser({
  fields: [
    { name: 'pdf', mode: 'single', allowed: PDF_MIME, maxSizeMB: 100 },
    { name: 'cover', mode: 'single', allowed: IMAGE_MIME, maxSizeMB: 5 },
  ],
  globalMaxSizeMB: 110,
});

/**
 * ملفات الأبحاث:
 * - field: files
 * - maxCount: 5
 * - الأنواع: PDF / DOC / DOCX
 * - الحجم لكل ملف: 10MB
 */
export const uploadResearchFilesDisk = makeDiskUploadParser({
  fields: [
    {
      name: 'files',
      mode: 'array',
      maxCount: 5,
      allowed: DOC_MIME,
      maxSizeMB: 10,
    },
  ],
  globalMaxSizeMB: 12,
});
