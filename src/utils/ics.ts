// src/utils/ics.ts
/**
 * مولّد iCalendar (.ics) بسيط وعملي لمواعيد الاستشارات
 * - نستخدم UTC (منتهي بـ Z) عشان يبقى ثابت عبر كل الأنظمة
 * - يدعم Organizer + Attendees + URL + Location + Alarms (VALARM)
 * - بيعمل Line Folding (مهم لمعايير iCal)
 * - بيستخدم CRLF
 */

export type ICSAttendee = { name?: string; email: string };
export type ICSOrganizer = { name?: string; email: string };

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** YYYYMMDDTHHMMSSZ من كائن Date (UTC) */
export function toICSDateUTC(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/** هروب نصوص iCal (Backslash / New lines / Commas / Semicolons) */
export function escapeICSText(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Line folding حسب RFC 5545
 * أي سطر أطول من ~75 حرف لازم يتكسر ويكمل بسطر جديد يبدأ بمسافة واحدة.
 */
function foldLine(line: string): string {
  const limit = 75;
  if (line.length <= limit) return line;

  let out = '';
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + limit);
    out += i === 0 ? chunk : '\r\n ' + chunk;
    i += limit;
  }
  return out;
}

export interface BuildICSOptions {
  uid: string; // معرف فريد للحدث (يفضل ثابت لكل حجز)
  start: Date; // UTC
  end: Date; // UTC
  title: string; // SUMMARY
  description?: string; // DESCRIPTION (نص فقط)
  url?: string; // URL (رابط الاجتماع/تفاصيل)
  location?: string; // LOCATION
  organizer?: ICSOrganizer; // ORGANIZER
  attendees?: ICSAttendee[];
  alarmMinutes?: number[]; // مثال: [1440, 120]
  productId?: string; // PRODID
  calendarName?: string; // X-WR-CALNAME (اختياري)
  timeZone?: string; // X-WR-TIMEZONE (اختياري)
}

/**
 * buildICS:
 * بيرجع string جاهزة تتخزن كملف .ics أو تتبعت كـ attachment
 */
export function buildICS({
  uid,
  start,
  end,
  title,
  description,
  url,
  location,
  organizer,
  attendees = [],
  alarmMinutes = [],
  productId = '-//Mishkat//Consultations//EN',
  calendarName = 'Mishkat Consultations',
  timeZone = 'Asia/Riyadh',
}: BuildICSOptions): string {
  if (!uid) throw new Error('buildICS: uid is required');
  if (!start || !end) throw new Error('buildICS: start/end are required');
  if (end.getTime() <= start.getTime()) throw new Error('buildICS: end must be after start');
  if (!title) throw new Error('buildICS: title is required');

  const dtStamp = toICSDateUTC(new Date());
  const dtStart = toICSDateUTC(start);
  const dtEnd = toICSDateUTC(end);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${productId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeICSText(timeZone)}`,

    'BEGIN:VEVENT',
    `UID:${escapeICSText(uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(title)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  if (location) lines.push(`LOCATION:${escapeICSText(location)}`);
  if (url) lines.push(`URL:${escapeICSText(url)}`);

  if (organizer?.email) {
    const cn = organizer.name ? `;CN=${escapeICSText(organizer.name)}` : '';
    lines.push(`ORGANIZER${cn}:MAILTO:${organizer.email}`);
  }

  for (const a of attendees) {
    if (!a?.email) continue;
    const cn = a.name ? `;CN=${escapeICSText(a.name)}` : '';
    // ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:MAILTO:${a.email}`,
    );
  }

  for (const m of alarmMinutes) {
    const mins = Math.max(1, Math.floor(m));
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Reminder');
    lines.push(`TRIGGER:-PT${mins}M`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  // CRLF + Folding
  return lines.map(foldLine).join('\r\n');
}
