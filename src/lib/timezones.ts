/** Timezone option for dropdowns: value is IANA id, label includes abbrev (e.g. PST) */
export interface TimezoneOption {
  value: string;
  label: string;
}

/** Major US timezones first, then 12 other common global ones. */
const CURATED_TIMEZONE_IDS = [
  // American (major)
  "America/Los_Angeles",   // Pacific
  "America/Denver",       // Mountain
  "America/Chicago",      // Central
  "America/New_York",     // Eastern
  "America/Anchorage",    // Alaska
  "Pacific/Honolulu",     // Hawaii
  // Popular global (12)
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/Toronto",
  "Europe/Moscow",
];

function getLabel(value: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: value,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart?.value) {
      return `${value} (${tzPart.value})`;
    }
  } catch {
    // fallback
  }
  return value;
}

/** Short display name for a timezone (e.g. "CST", "PST") for messages. */
export function getTimezoneShortName(value: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: value,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart?.value) return tzPart.value;
  } catch {
    // fallback
  }
  return value;
}

/**
 * Get the UTC Date that corresponds to (dateStr, hour, half) interpreted in eventTimezone.
 * Used to convert creator's grid times to viewer's timezone for display.
 */
export function getSlotUtcDate(
  dateStr: string,
  hour: number,
  half: 0 | 1,
  eventTimezone: string
): Date {
  const minute = half === 0 ? 0 : 30;
  const [y, m, d] = dateStr.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: eventTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hour12: false,
    minute: "2-digit",
  });
  const targetMonth = String(m).padStart(2, "0");
  const targetDay = String(d).padStart(2, "0");
  const targetHour = hour;
  const targetMin = minute;
  const startUtc = Date.UTC(y, m - 1, d, hour - 12, minute, 0);
  const endUtc = Date.UTC(y, m - 1, d, hour + 12, minute, 0);
  for (let t = startUtc; t <= endUtc; t += 15 * 60 * 1000) {
    const date = new Date(t);
    const parts = formatter.formatToParts(date);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const month = get("month");
    const day = get("day");
    const h = parseInt(get("hour"), 10);
    const min = parseInt(get("minute"), 10);
    if (
      get("year") === String(y) &&
      month === targetMonth &&
      day === targetDay &&
      h === targetHour &&
      min === targetMin
    ) {
      return date;
    }
  }
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
}

/**
 * Format a slot (date, hour, half) in event TZ for display in viewer TZ.
 * Returns e.g. "9 AM" in the viewer's timezone.
 */
export function formatSlotTimeInTimezone(
  dateStr: string,
  hour: number,
  half: 0 | 1,
  eventTimezone: string,
  viewerTimezone: string
): string {
  const utcDate = getSlotUtcDate(dateStr, hour, half, eventTimezone);
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: viewerTimezone,
    hour: "numeric",
    minute: half === 1 ? "2-digit" : undefined,
    hour12: true,
  });
  let s = formatter.format(utcDate);
  if (half === 0 && s.includes(":00")) s = s.replace(/:00\s*/, " ");
  return s.replace(/\s*AM$/i, " AM").replace(/\s*PM$/i, " PM");
}

/**
 * Format a slot (e.g. "2025-03-15T14:00") for display in viewer's timezone with day of week.
 * Slot is interpreted in eventTimezone. Returns e.g. "Sat, Mar 15 @ 2:00 PM".
 */
export function formatSlotLabelInTimezone(
  slot: string,
  eventTimezone: string,
  viewerTimezone: string
): string {
  const [dateStr, timePart] = slot.split("T");
  const [hourStr, minuteStr] = (timePart ?? "00:00").split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10) || 0;
  const half = minute >= 30 ? 1 : 0;
  const utcDate = getSlotUtcDate(dateStr, hour, half, eventTimezone);
  const dateFormatter = new Intl.DateTimeFormat("en", {
    timeZone: viewerTimezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en", {
    timeZone: viewerTimezone,
    hour: "numeric",
    minute: minute >= 30 ? "2-digit" : undefined,
    hour12: true,
  });
  let timeStr = timeFormatter.format(utcDate);
  if (minute < 30 && timeStr.includes(":00")) timeStr = timeStr.replace(/:00\s*/, " ");
  timeStr = timeStr.replace(/\s*AM$/i, " AM").replace(/\s*PM$/i, " PM");
  return `${dateFormatter.format(utcDate)} @ ${timeStr}`;
}

/**
 * Format a slot's time in a specific timezone with abbreviation (e.g. "10:00 AM CST").
 * Slot is interpreted in eventTimezone; displayTz is the timezone to format in (usually same as event for "ground truth").
 */
export function formatSlotTimeWithAbbrev(
  slot: string,
  eventTimezone: string,
  displayTimezone: string
): string {
  const [dateStr, timePart] = slot.split("T");
  const [hourStr, minuteStr] = (timePart ?? "00:00").split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10) || 0;
  const half = minute >= 30 ? 1 : 0;
  const utcDate = getSlotUtcDate(dateStr, hour, half, eventTimezone);
  const timeFormatter = new Intl.DateTimeFormat("en", {
    timeZone: displayTimezone,
    hour: "numeric",
    minute: minute >= 30 ? "2-digit" : undefined,
    hour12: true,
  });
  let timeStr = timeFormatter.format(utcDate);
  if (minute < 30 && timeStr.includes(":00")) timeStr = timeStr.replace(/:00\s*/, " ");
  timeStr = timeStr.replace(/\s*AM$/i, " AM").replace(/\s*PM$/i, " PM");
  return `${timeStr} ${getTimezoneShortName(displayTimezone)}`;
}

/** Curated list: major US (Pacific, Mountain, Central, Eastern, Alaska, Hawaii) + 12 common global timezones. */
/** Pass currentTimezone (e.g. from the browser) to prepend it if it's not in the list. */
export function getTimezoneOptions(currentTimezone?: string): TimezoneOption[] {
  const base = CURATED_TIMEZONE_IDS.map((value) => ({
    value,
    label: getLabel(value),
  }));
  if (
    currentTimezone &&
    currentTimezone.trim() &&
    !CURATED_TIMEZONE_IDS.includes(currentTimezone)
  ) {
    return [
      { value: currentTimezone, label: getLabel(currentTimezone) },
      ...base,
    ];
  }
  return base;
}
