// src/middlewares/mongoSanitizeBody.ts
import type { RequestHandler } from 'express';

/** يحذف أي مفاتيح تبدأ بـ $ أو تحتوي على '.' (بشكل عميق) */
function sanitizeInPlace(obj: any) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    // منع حقن المشغلات والمفاتيح الخطرة
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const v = obj[key];
    if (v && typeof v === 'object') sanitizeInPlace(v);
  }
}

export const mongoSanitizeBody = (): RequestHandler => (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeInPlace(req.body); // ✅ تعديل في المكان بدون أي reassignment
  }
  next();
};
