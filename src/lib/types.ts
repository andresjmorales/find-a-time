export interface Event {
  id: string;
  name: string;
  dates: string[]; // ISO date strings like "2025-03-15"
  startHour: number; // 0-23
  endHour: number; // 0-23
  createdAt: string;
}

export interface Availability {
  participantName: string;
  slots: string[]; // "2025-03-15T14:00" format
}

export interface EventWithAvailability extends Event {
  availability: Availability[];
}
