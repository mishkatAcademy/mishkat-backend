// src/middlewares/idempotency.ts
import type { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import AppError from '../utils/AppError';
import { ServerResponse, IncomingMessage } from 'http';
// import type { RedisClientType } from 'redis'; // لو هتستخدم node-redis v4

type Options = {
  ttlSec?: number;
  // redis?: RedisClientType; // فعّل لو عندك عميل Redis
};

const METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Fallback بسيط في الديف (مش مناسب للإنتاج)
const mem = new Map<string, { expiresAt: number; data?: any }>();

export function idempotency({ ttlSec = 300 /*, redis*/ }: Options = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // طبّق فقط على الميثود غير الآمنة
    if (!METHODS.has(req.method.toUpperCase())) return next();

    // اقرأ الهيدر (case-insensitive)
    const rawKey = req.get('Idempotency-Key');
    if (!rawKey) return next(AppError.badRequest('Missing Idempotency-Key', 'E_IDEMPOTENCY'));

    // فلترة بسيطة للمفتاح (اختياري لكنها مفيدة)
    if (rawKey.length > 128) {
      return next(AppError.badRequest('Idempotency-Key too long', 'E_IDEMPOTENCY_LEN'));
    }
    if (!/^[A-Za-z0-9._\-:]+$/.test(rawKey)) {
      return next(AppError.badRequest('Invalid Idempotency-Key format', 'E_IDEMPOTENCY_FMT'));
    }

    // ضيّق النطاق (scoping) بالمستخدم + الميثود + المسار لتجنّب تصادمات عبر مستخدمين/مسارات مختلفة
    const scopeUser = req.user?.id ?? 'anon';
    const scopeRoute = `${req.baseUrl}${req.path}`;
    const cacheKey = `idemp:${scopeUser}:${req.method}:${scopeRoute}:${rawKey}`;

    const now = Date.now();

    // Helpers: get/set باستخدام Redis إن وجد، وإلا الذاكرة
    const getCache = async () => {
      // if (redis) {
      //   const raw = await redis.get(cacheKey);
      //   return raw ? JSON.parse(raw) : null;
      // }
      const v = mem.get(cacheKey);
      if (v && v.expiresAt > now) return v.data ?? 'LOCK';
      if (v) mem.delete(cacheKey);
      return null;
    };

    const setLock = async () => {
      // لو Redis: SET NX EX
      // if (redis) return redis.set(cacheKey, JSON.stringify('LOCK'), { NX: true, EX: ttlSec });
      if (mem.has(cacheKey)) return null;
      mem.set(cacheKey, { expiresAt: now + ttlSec * 1000 });
      return 'OK';
    };

    const setResult = async (data: any) => {
      // if (redis) return redis.set(cacheKey, JSON.stringify(data), { XX: true, EX: ttlSec });
      mem.set(cacheKey, { expiresAt: now + ttlSec * 1000, data });
    };

    // 1) لو فيه نتيجة محفوظة → رجّعها فورًا
    const cached = await getCache();
    if (cached && cached !== 'LOCK') {
      const r = cached as { statusCode: number; headers?: Record<string, string>; body: string };
      res.status(r.statusCode);
      if (r.headers) {
        for (const [h, v] of Object.entries(r.headers)) {
          res.setHeader(h, v);
        }
      }
      return res.send(r.body);
    }

    // 2) لو فيه LOCK (طلب سابق قيد التنفيذ) → 409
    if (cached === 'LOCK') {
      return next(AppError.conflict('Duplicate request (in progress)', 'E_IDEMPOTENT_IN_PROGRESS'));
    }

    // 3) حاول تاخد LOCK
    const locked = await setLock();
    if (!locked) {
      return next(AppError.conflict('Duplicate request', 'E_IDEMPOTENCY_DUP'));
    }

    // 4) إلتقط الاستجابة عشان نخزنها
    const chunks: Buffer[] = [];
    const _write = res.write.bind(res);
    const _end = res.end.bind(res);

    (res.write as any) = (chunk: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return _write(chunk, ...args);
    };
    (res.end as any) = (chunk?: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return _end(chunk, ...args);
    };

    onFinished(res as unknown as ServerResponse<IncomingMessage>, async () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const headersToSave: Record<string, string> = {};
        for (const h of ['content-type', 'content-length', 'etag', 'cache-control']) {
          const val = res.getHeader(h);
          if (val != null) headersToSave[h] = String(val);
        }
        await setResult({ statusCode: res.statusCode, headers: headersToSave, body });
      } catch {
        // تجاهل أي خطأ في التخزين
      }
    });

    return next();
  };
}
