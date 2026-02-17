// utils/time.ts
/** يرجّع YYYY-MM-DD بتوقيت الرياض من أي Date */
export function toRiyadhYMD(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // en-CA -> YYYY-MM-DD
}
