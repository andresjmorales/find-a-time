export interface Event {
  id: string;
  name: string;
  dates: string[]; // ISO date strings like "2025-03-15"
  startHour: number; // 0-23
  endHour: number; // 0-23
  eventTimezone?: string; // creator's TZ; grid is in this TZ
  createdAt: string;
  /** When true, respondents only see Great / Unavailable (no "If needed"). */
  disableIfNeeded?: boolean;
  /** Weight for "If needed" in scoring: 0–1, default 0.75. Great = 1. Ignored when disableIfNeeded. */
  ifNeededWeight?: number;
  /** When set, survey stops accepting new responses and may show expired view. ISO date string (e.g. YYYY-MM-DD). */
  expiresAt?: string;
  /** When true and expiresAt is set, group results are hidden until after expiration. */
  hideResultsUntilExpiration?: boolean;
}

export interface Availability {
  participantName: string;
  timezone?: string; // e.g. "America/New_York"
  slots: string[]; // "2025-03-15T14:00" — great (green), in event TZ
  slotsIfNeeded?: string[]; // "if needed" / non-ideal (yellow); unselected = unavailable (red)
  otherAvailabilityNote?: string; // e.g. "Friday 2–4pm my time" when times don't fit grid
}

export interface EventWithAvailability extends Event {
  availability: Availability[];
}
