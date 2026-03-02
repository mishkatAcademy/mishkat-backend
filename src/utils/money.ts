// src/utils/money.ts
import AppError from './AppError';

/** نظّف سترنج فلوس: شيل مسافات/فواصل */
function normalizeAmountString(s: string) {
  return s.replace(/\s/g, '').replace(/,/g, '');
}

/** تحقق max 2 decimals (قبل التحويل) */
function ensureMax2Decimals(n: number) {
  // يمنع 12.345
  if (Math.round(n * 100) !== n * 100) {
    throw AppError.badRequest('Amount must have at most 2 decimal places');
  }
}

/** حوّل مبلغ (SAR) إلى هللة (int). يقبل number أو string "12.34" */
export function toHalalas(amount: number | string): number {
  let n: number;

  if (typeof amount === 'string') {
    const cleaned = normalizeAmountString(amount);
    n = Number(cleaned);
    if (!Number.isFinite(n)) throw AppError.badRequest('Invalid amount');
  } else {
    n = amount;
    if (!Number.isFinite(n)) throw AppError.badRequest('Invalid amount');
  }

  if (n < 0) throw AppError.badRequest('Amount must be >= 0');
  ensureMax2Decimals(n);

  return Math.round(n * 100);
}

/** حوّل هللة إلى مبلغ (ريال) */
export function fromHalalas(halalas: number): number {
  if (!Number.isInteger(halalas) || halalas < 0) throw AppError.badRequest('Invalid halalas');
  return halalas / 100;
}

/** صيغة عرض حسب اللغة/العملة */
export function formatMoney(
  halalas: number,
  { currency = 'SAR', locale = 'ar-SA' }: { currency?: string; locale?: string } = {},
): string {
  const amount = fromHalalas(halalas);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** helpers */
/** أمور بسيطة للتعامل مع الهللات */
export const halalas = {
  fromNumber(n: number) {
    return toHalalas(n);
  },
  toSARString(h: number) {
    return fromHalalas(h).toFixed(2);
  },
  toSAR(h: number) {
    return fromHalalas(h);
  },
};
