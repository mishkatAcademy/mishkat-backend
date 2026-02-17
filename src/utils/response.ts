// src/utils/response.ts
import type { Response } from 'express';

/**
 * ✅ Helpers للاستجابات الموحّدة
 * الشكل القياسي:
 *  - النجاح:  { status: 'success', data, meta? }
 *  - الفشل:   { status: 'fail', message, ...extra }
 *  - خطأ عام: { status: 'error', message }
 *
 * ملاحظات:
 * - استخدم ok/created/noContent في مسارات النجاح.
 */

export type ApiMeta = Record<string, unknown>;

/** 200 OK */
export function ok<T>(res: Response, data: T, meta?: ApiMeta) {
  return res.status(200).json({ status: 'success', data, ...(meta ? { meta } : {}) });
}

/** 201 Created */
export function created<T>(res: Response, data: T, meta?: ApiMeta) {
  return res.status(201).json({ status: 'success', data, ...(meta ? { meta } : {}) });
}

/** 204 No Content */
export function noContent(res: Response) {
  return res.status(204).send();
}
