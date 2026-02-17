// src/utils/catchAsync.ts
import type { RequestHandler } from 'express';

/**
 * تغليف أي هاندلر async بحيث أي خطأ يروح تلقائيًا لـ next(error)
 * - ترجع RequestHandler عادي، فتركّبها مباشرة على الراوتر.
 * - بتحافظ على التايب العام للهاندلر.
 */
export default function catchAsync<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    // مهم: متخليش الفنكشن هنا async عشان ما تضيعش الـ .catch(next)
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
