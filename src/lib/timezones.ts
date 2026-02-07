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
