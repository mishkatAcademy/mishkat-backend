// src/utils/catchAsync.ts
import type { RequestHandler } from 'express';

/**
 * تغليف أي هاندلر async بحيث أي خطأ يروح تلقائيًا لـ next(error)
 * - نرجع RequestHandler عادي، فنقوم بتركيبها مباشرة على الراوتر.
 * - بنحافظ على التايب العام للهاندلر.
 */
export default function catchAsync<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
