// src/middlewares/mongoSanitizeBody.ts
import type { RequestHandler } from 'express';

function sanitizeInPlace(obj: any) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
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
    sanitizeInPlace(req.body);
  }
  next();
};
