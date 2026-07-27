import { Event } from "./types";

/** Max dates allowed when creating an event (matches home UI). */
export const MAX_EVENT_DATES = 7;

/** Reasonable bounds for free-text fields. */
export const MAX_EVENT_NAME_LENGTH = 120;
export const MAX_PARTICIPANT_NAME_LENGTH = 80;
export const MAX_OTHER_NOTE_LENGTH = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|30)$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function isValidTimeZone(value: string | undefined): boolean {
  if (!value) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Minute may be any 0–59 (used for expiration end-of-day).
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  });
  const targetMonth = String(m).padStart(2, "0");
  const targetDay = String(d).padStart(2, "0");
  // Search a ±14h window around a UTC guess so DST transitions are covered.
  const startUtc = Date.UTC(y, m - 1, d, hour - 14, minute, 0);
  const endUtc = Date.UTC(y, m - 1, d, hour + 14, minute, 0);
  for (let t = startUtc; t <= endUtc; t += 60 * 1000) {
    const date = new Date(t);
    const parts = formatter.formatToParts(date);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const h = parseInt(get("hour"), 10);
    const min = parseInt(get("minute"), 10);
    if (
      get("year") === String(y) &&
      get("month") === targetMonth &&
      get("day") === targetDay &&
      h === hour &&
      min === minute
    ) {
      return date;
    }
  }
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
}

/**
 * Expiration is a calendar date (YYYY-MM-DD) meaning end of that day in the
 * event's timezone (UTC if unset). Full ISO strings are parsed as-is.
 */
export function getExpirationInstant(
  expiresAt: string,
  eventTimezone?: string
): Date {
  if (expiresAt.includes("T")) return new Date(expiresAt);
  const tz =
    eventTimezone && isValidTimeZone(eventTimezone) ? eventTimezone : "UTC";
  return zonedDateTimeToUtc(expiresAt, 23, 59, tz);
}

export function isEventExpired(
  event: Pick<Event, "expiresAt" | "eventTimezone">,
  now: Date = new Date()
): boolean {
  if (!event.expiresAt) return false;
  return now.getTime() > getExpirationInstant(event.expiresAt, event.eventTimezone).getTime();
}

export function shouldHideResults(
  event: Pick<Event, "expiresAt" | "eventTimezone" | "hideResultsUntilExpiration">,
  now: Date = new Date()
): boolean {
  return (
    !!event.hideResultsUntilExpiration &&
    !!event.expiresAt &&
    !isEventExpired(event, now)
  );
}

export function slotKey(date: string, hour: number, half: 0 | 1): string {
  return `${date}T${String(hour).padStart(2, "0")}:${half === 0 ? "00" : "30"}`;
}

/** Build the set of valid slot keys for an event's date/hour window. */
export function buildValidSlotSet(
  dates: string[],
  startHour: number,
  endHour: number
): Set<string> {
  const valid = new Set<string>();
  for (const date of dates) {
    for (let hour = startHour; hour < endHour; hour++) {
      valid.add(slotKey(date, hour, 0));
      valid.add(slotKey(date, hour, 1));
    }
  }
  return valid;
}

export function filterValidSlots(
  slots: unknown,
  valid: Set<string>
): string[] {
  if (!Array.isArray(slots)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    if (typeof s !== "string" || !SLOT_RE.test(s) || !valid.has(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function normalizeParticipantName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Case-insensitive match for re-submitting as the same person. */
export function sameParticipant(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
