// مجرد بداية الشغل الأساسي في version II إن شاء الله

// src/utils/mail/consultations.ts
/**
 * قوالب بريد خاصة بالاستشارات:
 * - تأكيد الحجز (مع مرفق ICS)
 * - تذكير قبل الموعد (اختياري)
 */

import { buildICS } from '../ics';

type LocalizedText = { ar?: string; en?: string };

export interface ConsultationEmailContext {
  brandName?: string; // افتراضي "أكاديمية مشكاة"
  locale?: 'ar' | 'en'; // لعرض التاريخ
  meetingUrl?: string; // رابط اللقاء (Zoom/Meet/…)
  instructorName?: string; // اسم المدرّس
  offeringTitle: LocalizedText; // عنوان الباقة
  startUTC: Date; // موعد البداية UTC
  endUTC: Date; // موعد النهاية UTC
  recipient: { name: string; email: string };
  organizer?: { name?: string; email: string }; // مرسل الدعوة
  uid: string; // معرف فريد للحدث (ثابت للحجز)
}

/** formatter بسيط لعرض التاريخ بتوقيت الرياض */
function formatRiyadhRange(startUTC: Date, endUTC: Date, locale: 'ar' | 'en' = 'ar') {
  // نعرض التوقيت المحلي (Asia/Riyadh = UTC+3). للاختصار نستخدم offset ثابت.
  const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
  const s = addMinutes(startUTC, 180);
  const e = addMinutes(endUTC, 180);

  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${fmt.format(s)} — ${fmt.format(e)} (بتوقيت الرياض)`;
}

function pickText(t: LocalizedText, locale: 'ar' | 'en' = 'ar') {
  return (locale === 'ar' ? t.ar : t.en) || t.ar || t.en || '';
}

/** يولّد مرفق ICS مناسب للحدث */
function buildConsultationICS(ctx: ConsultationEmailContext) {
  const title =
    `${ctx.brandName ?? 'أكاديمية مشكاة'} - ` +
    (pickText(ctx.offeringTitle, ctx.locale) || 'استشارة');
  const description =
    (ctx.instructorName ? `المدرّس: ${ctx.instructorName}\n` : '') +
    (ctx.meetingUrl ? `رابط اللقاء: ${ctx.meetingUrl}\n` : '') +
    `هذه رسالة تأكيد موعدك.`;

  const ics = buildICS({
    uid: ctx.uid,
    start: ctx.startUTC,
    end: ctx.endUTC,
    title,
    description,
    url: ctx.meetingUrl,
    organizer: ctx.organizer,
    attendees: [{ name: ctx.recipient.name, email: ctx.recipient.email }],
    alarmMinutes: [1440, 120], // 24 ساعة و 2 ساعة
    productId: '-//Mishkat//Consultations//AR',
  });

  return {
    filename: 'consultation.ics',
    content: ics,
    contentType: 'text/calendar; charset=utf-8',
  };
}

/** بريد تأكيد الحجز */
export function consultationConfirmationEmail(ctx: ConsultationEmailContext) {
  const brand = ctx.brandName ?? 'أكاديمية مشكاة';
  const when = formatRiyadhRange(ctx.startUTC, ctx.endUTC, ctx.locale);
  const offering = pickText(ctx.offeringTitle, ctx.locale) || 'استشارة';
  const teacher = ctx.instructorName ? `مع ${ctx.instructorName}` : '';
  const linkLine = ctx.meetingUrl
    ? `<p style="margin:8px 0">رابط اللقاء: <a href="${ctx.meetingUrl}">${ctx.meetingUrl}</a></p>`
    : '';

  const subject =
    ctx.locale === 'en'
      ? `${brand} — Consultation confirmed (${offering})`
      : `${brand} — تأكيد حجز استشارة (${offering})`;

  const html =
    ctx.locale === 'en'
      ? `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <h2 style="margin:0 0 8px">${brand} — Consultation confirmed</h2>
    <p style="margin:8px 0"><strong>Service:</strong> ${offering}</p>
    ${ctx.instructorName ? `<p style="margin:8px 0"><strong>Instructor:</strong> ${ctx.instructorName}</p>` : ''}
    <p style="margin:8px 0"><strong>When:</strong> ${when}</p>
    ${linkLine}
    <p style="margin:16px 0">We've attached an <b>.ics</b> calendar invite to add it to your calendar.</p>
    <p style="margin:16px 0">Best regards,<br/>${brand}</p>
  </div>
  `
      : `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; direction:rtl; text-align:right">
    <h2 style="margin:0 0 8px">${brand} — تأكيد حجز استشارة</h2>
    <p style="margin:8px 0"><strong>الخدمة:</strong> ${offering} ${teacher}</p>
    <p style="margin:8px 0"><strong>الموعد:</strong> ${when}</p>
    ${linkLine}
    <p style="margin:16px 0">أرفقنا لك ملف <b>.ics</b> لإضافة الموعد إلى تقويمك.</p>
    <p style="margin:16px 0">تحياتنا،<br/>${brand}</p>
  </div>
  `;

  const text =
    ctx.locale === 'en'
      ? `${brand} — Consultation confirmed
Service: ${offering} ${ctx.instructorName ? `with ${ctx.instructorName}` : ''}
When: ${when}
${ctx.meetingUrl ? `Meeting URL: ${ctx.meetingUrl}` : ''}

An .ics calendar invite is attached.

– ${brand}
`
      : `${brand} — تأكيد حجز استشارة
الخدمة: ${offering} ${ctx.instructorName ? `مع ${ctx.instructorName}` : ''}
الموعد: ${when}
${ctx.meetingUrl ? `رابط اللقاء: ${ctx.meetingUrl}` : ''}

مرفق ملف .ics لإضافة الموعد إلى تقويمك.

– ${brand}
`;

  const icsAttachment = buildConsultationICS(ctx);

  return {
    subject,
    html,
    text,
    attachments: [icsAttachment],
  };
}

/** بريد تذكير بسيط قبل الموعد */
export function consultationReminderEmail(ctx: ConsultationEmailContext) {
  const brand = ctx.brandName ?? 'أكاديمية مشكاة';
  const when = formatRiyadhRange(ctx.startUTC, ctx.endUTC, ctx.locale);
  const offering = pickText(ctx.offeringTitle, ctx.locale) || 'استشارة';
  const teacher = ctx.instructorName ? `مع ${ctx.instructorName}` : '';

  const subject =
    ctx.locale === 'en'
      ? `${brand} — Upcoming consultation reminder`
      : `${brand} — تذكير بموعد الاستشارة`;

  const html =
    ctx.locale === 'en'
      ? `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <h3 style="margin:0 0 8px">Reminder — upcoming consultation</h3>
    <p style="margin:8px 0"><strong>Service:</strong> ${offering} ${ctx.instructorName ? `(with ${ctx.instructorName})` : ''}</p>
    <p style="margin:8px 0"><strong>When:</strong> ${when}</p>
    ${ctx.meetingUrl ? `<p style="margin:8px 0">Meeting URL: <a href="${ctx.meetingUrl}">${ctx.meetingUrl}</a></p>` : ''}
    <p style="margin:16px 0">Good luck!</p>
  </div>
  `
      : `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; direction:rtl; text-align:right">
    <h3 style="margin:0 0 8px">تذكير — موعد الاستشارة قريب</h3>
    <p style="margin:8px 0"><strong>الخدمة:</strong> ${offering} ${teacher}</p>
    <p style="margin:8px 0"><strong>الموعد:</strong> ${when}</p>
    ${ctx.meetingUrl ? `<p style="margin:8px 0">رابط اللقاء: <a href="${ctx.meetingUrl}">${ctx.meetingUrl}</a></p>` : ''}
    <p style="margin:16px 0">نتمنى لك جلسة موفّقة.</p>
  </div>
  `;

  const text =
    ctx.locale === 'en'
      ? `Reminder — upcoming consultation
Service: ${offering} ${ctx.instructorName ? `(with ${ctx.instructorName})` : ''}
When: ${when}
${ctx.meetingUrl ? `Meeting URL: ${ctx.meetingUrl}` : ''}

– ${brand}
`
      : `تذكير — موعد الاستشارة قريب
الخدمة: ${offering} ${teacher}
الموعد: ${when}
${ctx.meetingUrl ? `رابط اللقاء: ${ctx.meetingUrl}` : ''}

– ${brand}
`;

  return { subject, html, text, attachments: [] as any[] };
}
