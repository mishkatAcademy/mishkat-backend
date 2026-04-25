// src/utils/timeSlots.ts
/**
 * أدوات توليد وفلترة الـ time slots بالاعتماد على توقيت الرياض (UTC+3 بلا DST).
 *
 * ✅ ما الذي يقدّمه الملف؟
 * - dayIndexSaturday0: يحسب رقم اليوم 0..6 بحيث 0=السبت
 * - dateInRiyadhToUTC: يحوّل تاريخ محلي "YYYY-MM-DD" + "HH:mm" إلى Date (UTC)
 * - generateSlotsForWindow: يولّد سلوتس داخل نافذة يومية مع مدة + buffer
 * - overlaps: يتحقق من تداخل فترتين زمنيتين
 * - أدوات مساعدة (تحويل HH:mm ⇄ دقائق، التحقق من HH:mm)
 *
 * 🧠 ملاحظات:
 * - نحن نفترض أن Asia/Riyadh = UTC+3 دون تغيير (لا توقيت صيفي).
 * - جميع الدوال تُرجع كائنات Date في التوقيت العالمي UTC.
 */

export type Slot = { start: Date; end: Date };

const RIYADH_OFFSET_MIN = 3 * 60; // +03:00
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** هل السلسلة بصيغة HH:mm؟ */
export function isValidHHMM(s: string): boolean {
  return HHMM_REGEX.test(String(s || '').trim());
}

/** يحوّل "HH:mm" إلى عدد دقائق من بداية اليوم */
export function hhmmToMinutes(hhmm: string): number {
  if (!isValidHHMM(hhmm)) throw new Error(`Invalid HH:mm: ${hhmm}`);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** يحوّل الدقائق إلى "HH:mm" (يوم واحد فقط) */
export function minutesToHHMM(mins: number): string {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(mm)}`;
}

// بنستخدم noon بدل midnight عشان midnight في UTC يروح لليوم السابق ويبوّظ حساب اليوم
function riyadhNoonUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date YYYY-MM-DD: ${dateStr}`);

  // 12:00 (الرياض) = 09:00 UTC  => نطرح 3 ساعات
  const ms = Date.UTC(y, m - 1, d, 12 - RIYADH_OFFSET_MIN / 60, 0, 0, 0);
  return new Date(ms);
}

/**
 * يحسب اليوم 0..6 بحيث:
 * 0=السبت, 1=الأحد, 2=الاثنين, 3=الثلاثاء, 4=الأربعاء, 5=الخميس, 6=الجمعة
 * (باستخدام منتصف الليل المحلي للرياض)
 */
export function dayIndexSaturday0(dateStr: string): number {
  const noon = riyadhNoonUTC(dateStr);
  const jsSunday0 = noon.getUTCDay(); // 0=Sunday..6=Saturday (but now correct day)
  return (jsSunday0 + 1) % 7; // 0=Saturday..6=Friday
}

/**
 * يحوّل تاريخ محلي (الرياض) + وقت HH:mm إلى Date (UTC) تمثّل نفس اللحظة.
 * مثال: ("2025-04-20", "15:00") → 12:00 UTC ككائن Date.
 */
export function dateInRiyadhToUTC(dateStr: string, hhmm: string): Date {
  if (!isValidHHMM(hhmm)) throw new Error(`Invalid HH:mm: ${hhmm}`);
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date YYYY-MM-DD: ${dateStr}`);
  const [hh, mm] = hhmm.split(':').map(Number);
  // نحصل على نفس اللحظة بالـ UTC عبر طرح 3 ساعات
  const ms = Date.UTC(y, m - 1, d, hh - RIYADH_OFFSET_MIN / 60, mm, 0, 0);
  return new Date(ms);
}

/**
 * يولّد سلوتس داخل نافذة زمنية في نفس اليوم المحلي (الرياض):
 * - يبدأ من startHHMM وحتى endHHMM (غير شاملة للنهاية)
 * - طول كل سلوت = durationMinutes
 * - الفراغ بين نهاية سلوت وبداية التالي = bufferMinutes
 *
 * مثال:
 * window 09:00→12:00, duration=30, buffer=10
 * → 09:00-09:30, 09:40-10:10, 10:20-10:50, 11:00-11:30, 11:40-12:10 (الأخير يُستبعد لأن النهاية تتخطى 12:00)
 */
export function generateSlotsForWindow(
  dateStr: string,
  startHHMM: string,
  endHHMM: string,
  durationMinutes: number,
  bufferMinutes = 0,
): Slot[] {
  if (!isValidHHMM(startHHMM) || !isValidHHMM(endHHMM)) return [];
  const startMin = hhmmToMinutes(startHHMM);
  const endMin = hhmmToMinutes(endHHMM);

  if (endMin <= startMin) return [];
  if (durationMinutes <= 0) return [];

  const step = Math.max(1, Math.floor(durationMinutes + Math.max(0, bufferMinutes)));
  const out: Slot[] = [];

  let current = startMin;
  while (current + durationMinutes <= endMin) {
    const sHHMM = minutesToHHMM(current);
    const eHHMM = minutesToHHMM(current + durationMinutes);
    const start = dateInRiyadhToUTC(dateStr, sHHMM);
    const end = dateInRiyadhToUTC(dateStr, eHHMM);
    out.push({ start, end });
    current += step;
  }

  return out;
}

/** هل يوجد تداخل زمني بين [aStart,aEnd) و [bStart,bEnd) ؟ */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
