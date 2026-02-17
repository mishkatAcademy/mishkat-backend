// src/utils/AppError.ts
export type AppErrorStatus = 'fail' | 'error';

/**
 * خطأ مخصص للتعامل معه بشكل آمن (Operational Error).
 * يتضمن: statusCode, status, code, cause, details
 */
export class AppError extends Error {
  public statusCode: number;
  public status: AppErrorStatus;
  public isOperational: boolean;
  public code?: string; // كود داخلي اختياري (E_NOT_FOUND, ...)
  public cause?: unknown; // Node 16+ يدعم cause
  public details?: unknown; // تفاصيل إضافية (مثلاً issues بتاعة Zod)

  constructor(
    message: string,
    statusCode = 400,
    options?: { code?: string; cause?: unknown; details?: unknown },
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode >= 500 ? 'error' : 'fail';
    this.isOperational = true;
    this.code = options?.code;
    this.cause = options?.cause;
    this.details = options?.details;

    // إصلاح سلسلة الوراثة في TS
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** helper: إضافة تفاصيل ثم الإرجاع للتسلسل */
  withDetails(details: unknown) {
    this.details = details;
    return this;
  }

  /** تمثيل JSONي آمن */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      status: this.status,
      code: this.code,
      isOperational: this.isOperational,
      details: this.details,
    };
  }

  // -------- Factory helpers شائعة --------
  static badRequest(message = 'Bad request', code?: string, details?: unknown) {
    return new AppError(message, 400, { code, details });
  }
  static unauthorized(message = 'Unauthorized', code?: string, details?: unknown) {
    return new AppError(message, 401, { code, details });
  }
  static forbidden(message = 'Forbidden', code?: string, details?: unknown) {
    return new AppError(message, 403, { code, details });
  }
  static notFound(message = 'Not found', code?: string, details?: unknown) {
    return new AppError(message, 404, { code, details });
  }
  static conflict(message = 'Conflict', code?: string, details?: unknown) {
    return new AppError(message, 409, { code, details });
  }
  static tooMany(message = 'Too many requests', code?: string, details?: unknown) {
    return new AppError(message, 429, { code, details });
  }
  static internal(message = 'Internal server error', code?: string, details?: unknown) {
    return new AppError(message, 500, { code, details });
  }
}

/** Type guard: يميّز AppError عن باقي الأخطاء */
export function isAppError(err: unknown): err is AppError {
  return !!err && typeof err === 'object' && (err as any).isOperational === true;
}

export default AppError;
