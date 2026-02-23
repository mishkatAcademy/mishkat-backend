// src/routes/researchDownloadRoutes.ts
import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import slowDown from 'express-slow-down';

import ResearchRequest from '../models/ResearchRequest';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import AppError from '../utils/AppError';
import { validateObjectId } from '../middlewares/validateObjectId';
import { getAbsolutePath } from '../services/localFiles.disk';

const pipe = promisify(pipeline);
const router = Router();

/**
 * 🔐 جذر ملفات الرفع للموديول
 * - نخزّن في الداتابيز "relativePath" تحت uploads/research
 * - هنا بنبني المسار المطلق ونضمن إنه داخل الجذر
 */
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads', 'research');
// const UPLOADS_ROOT = path.join(process.cwd(), 'uploads', 'private', 'research');

/** ✅ تأكد أن المسار داخل الجذر (منع path traversal) */
function assertInsideRoot(absPath: string) {
  const root = path.resolve(UPLOADS_ROOT);
  const target = path.resolve(absPath);
  if (!target.startsWith(root + path.sep)) {
    throw AppError.forbidden('Invalid file path');
  }
}

/** 📎 Content-Disposition آمن يدعم UTF-8 */
function contentDispositionAttachment(originalName: string) {
  const safe = originalName.replace(/[\r\n"]/g, '_'); // sanitize بسيط
  const utf8 = encodeURIComponent(originalName);
  return `attachment; filename="${safe}"; filename*=UTF-8''${utf8}`;
}

/**
 * 🧩 إرسال مرفق كـ attachment عبر Stream
 * - يدعم 304 If-Modified-Since (بسيط)
 * - يوقف الاستريم عند إغلاق اتصال العميل (aborted/close)
 * - بدون استخدام req.signal (غير موجود في Express)
 */
async function sendAttachment(
  req: Request,
  res: Response,
  absPath: string,
  mime: string | undefined,
  originalName: string,
) {
  // وجود الملف + بياناته
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(absPath);
  } catch {
    throw AppError.notFound('الملف غير موجود على الخادم');
  }

  // 304 If-Modified-Since (اختياري/خفيف)
  const ifMod = req.headers['if-modified-since'];
  if (ifMod) {
    const since = new Date(String(ifMod)).getTime();
    if (!Number.isNaN(since) && stat.mtime.getTime() <= since) {
      res.status(304).end();
      return;
    }
  }

  // هيدرز الحماية والتحميل
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDispositionAttachment(originalName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

  const readStream = fs.createReadStream(absPath);

  // لو العميل قفل الاتصال، هنوقف الاستريم
  const onAbort = () => {
    readStream.destroy();
  };
  // استخدم once للتنظيف تلقائيًا بعد أول نداء
  req.once('aborted', onAbort);
  res.once('close', onAbort);

  try {
    await pipe(readStream, res);
  } catch (err: any) {
    // لو العميل قفل أثناء البث، هتلاقي أخطاء زي ERR_STREAM_PREMATURE_CLOSE — تجاهلها
    const msg = String(err?.code || err?.name || '');
    if (
      msg.includes('ERR_STREAM_PREMATURE_CLOSE') ||
      msg.includes('ECONNRESET') ||
      msg.includes('EPIPE')
    ) {
      return; // اتصال اتقفل — مافيش حاجة نعملها
    }
    throw err;
  }
}

/* =========================================================================
  🛡️ Rate-limit & Slowdown لنقاط التحميل
  - لو فيه user: استخدم id، وإلا ipKeyGenerator (IPv6-safe)
  - slowDown v2: delayMs ثابت + validate: {delayMs:false}
   ========================================================================= */
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ((req: Request) =>
    req.user?.id ? String(req.user.id) : ipKeyGenerator(req as any)) as Options['keyGenerator'],
});

const downloadSlow = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 40,
  delayMs: () => 250, // v2: ثابت
  validate: { delayMs: false }, // إسكات التحذير التوافقي
});

/* =========================================================================
  👤 1) تحميل مرفق لمالك الطلب
  GET /api/v1/research-download/me/:id/attachments/:storedName
   ========================================================================= */
router.get(
  '/me/:id/attachments/:storedName',
  protect,
  validateObjectId('id'),
  downloadLimiter,
  downloadSlow,
  async (req, res, next) => {
    try {
      const userId = req.user!.id.toString();
      const { id, storedName } =
        (req.validated?.params as { id: string; storedName: string }) ?? req.params;

      const reqDoc = await ResearchRequest.findById(id).lean();
      if (!reqDoc || reqDoc.isDeleted) throw AppError.notFound('طلب غير موجود');
      if (String(reqDoc.user) !== userId) throw AppError.forbidden('ليس طلبك');

      const att = reqDoc.attachments.find((a) => a.storedName === storedName);
      if (!att) throw AppError.notFound('مرفق غير موجود');

      // const absPath = path.join(process.cwd(), att.relativePath);
      const absPath = getAbsolutePath(att.relativePath);
      assertInsideRoot(absPath);

      await sendAttachment(req, res, absPath, att.mimeType, att.originalName);
    } catch (e) {
      next(e);
    }
  },
);

/* =========================================================================
  🛠️ 2) تحميل مرفق للإدمن
  GET /api/v1/research-download/:id/attachments/:storedName
   ========================================================================= */
router.get(
  '/:id/attachments/:storedName',
  protect,
  isAdmin,
  validateObjectId('id'),
  downloadLimiter,
  downloadSlow,
  async (req, res, next) => {
    try {
      const { id, storedName } =
        (req.validated?.params as { id: string; storedName: string }) ?? req.params;

      const reqDoc = await ResearchRequest.findById(id).lean();
      if (!reqDoc || reqDoc.isDeleted) throw AppError.notFound('طلب غير موجود');

      const att = reqDoc.attachments.find((a) => a.storedName === storedName);
      if (!att) throw AppError.notFound('مرفق غير موجود');

      // const absPath = path.join(process.cwd(), att.relativePath);
      const absPath = getAbsolutePath(att.relativePath);
      assertInsideRoot(absPath);

      await sendAttachment(req, res, absPath, att.mimeType, att.originalName);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
