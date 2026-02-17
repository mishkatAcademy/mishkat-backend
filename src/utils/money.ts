// src/utils/money.ts
/** حوّل مبلغ عشري (ريال) إلى هللة (int). يقبل number أو string "12.34" */
export function toHalalas(amount: number | string): number {
  if (typeof amount === 'string') {
    // تنظيف بسيط وparse
    const n = Number(amount.replace(/\s/g, ''));
    if (!Number.isFinite(n)) throw new Error('Invalid amount string');
    amount = n;
  }
  if (!Number.isFinite(amount)) throw new Error('Invalid amount');
  // نستخدم الضرب والقسمة لتجنّب كسور الفاصلة العائمة
  return Math.round(amount * 100);
}

/** حوّل هللة إلى مبلغ (ريال) بدقة 2 */
export function fromHalalas(halalas: number): number {
  if (!Number.isInteger(halalas) || halalas < 0) throw new Error('Invalid halalas');
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
  }).format(amount);
}

/** أمور بسيطة للتعامل مع الهللات */
export const halalas = {
  fromNumber(n: number) {
    // مثال: 12.34 SAR → 1234 هللة
    return Math.round(n * 100);
  },
  toSARString(h: number) {
    return (h / 100).toFixed(2); // "12.34"
  },
};
