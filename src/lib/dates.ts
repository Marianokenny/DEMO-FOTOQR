/**
 * Events are scheduled in Argentina time. Kept in one place so a per-event timezone can be added later.
 * Argentina has no daylight saving time, so a fixed offset is exact.
 */
export const APP_TIMEZONE = "America/Argentina/Buenos_Aires";
export const APP_UTC_OFFSET = "-03:00";

/** "2026-12-12T21:00" (local Argentina time from a datetime-local input) -> Date */
export function parseLocalDateTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00${APP_UTC_OFFSET}`);
}

/** Date -> "2026-12-12T21:00" in Argentina time, for datetime-local inputs. */
export function toLocalInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatDate(date: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: APP_TIMEZONE, ...opts }).format(date);
}

export function formatDateTime(date: Date) {
  return formatDate(date, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
