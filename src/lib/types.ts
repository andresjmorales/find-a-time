export interface Event {
  id: string;
  name: string;
  dates: string[]; // ISO date strings like "2025-03-15"
  startHour: number; // 0-23
  endHour: number; // 0-23
  eventTimezone?: string; // creator's TZ; grid is in this TZ
  createdAt: string;
}

export interface Availability {
  participantName: string;
  timezone?: string; // e.g. "America/New_York"
  slots: string[]; // "2025-03-15T14:00" — great (green), in event TZ
  slotsPrefer?: string[]; // if needed (yellow); unselected = unavailable (red)
  otherAvailabilityNote?: string; // e.g. "Friday 2–4pm my time" when times don't fit grid
}

export interface EventWithAvailability extends Event {
  availability: Availability[];
}
