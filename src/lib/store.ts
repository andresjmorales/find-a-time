import fs from "fs";
import path from "path";
import { EventWithAvailability } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readEvents(): Record<string, EventWithAvailability> {
  ensureDataDir();
  if (!fs.existsSync(EVENTS_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeEvents(events: Record<string, EventWithAvailability>) {
  ensureDataDir();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

export function createEvent(
  event: EventWithAvailability
): EventWithAvailability {
  const events = readEvents();
  events[event.id] = event;
  writeEvents(events);
  return event;
}

export function getEvent(id: string): EventWithAvailability | null {
  const events = readEvents();
  return events[id] || null;
}

export function addAvailability(
  eventId: string,
  participantName: string,
  slots: string[],
  slotsPrefer: string[] = [],
  timezone?: string
): EventWithAvailability | null {
  const events = readEvents();
  const event = events[eventId];
  if (!event) return null;

  event.availability = event.availability.filter(
    (a) => a.participantName !== participantName
  );
  event.availability.push({
    participantName,
    timezone,
    slots,
    slotsPrefer: slotsPrefer?.length ? slotsPrefer : undefined,
  });
  writeEvents(events);
  return event;
}
