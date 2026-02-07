import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { EventWithAvailability } from "./types";

const STORAGE_KEY = "find-a-time:events";

function useRedis(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// --- File store (local dev when Redis not configured) ---
const DATA_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readEventsSync(): Record<string, EventWithAvailability> {
  ensureDataDir();
  if (!fs.existsSync(EVENTS_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeEventsSync(events: Record<string, EventWithAvailability>) {
  ensureDataDir();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

// --- Async store API (Redis when on Vercel with env; else file) ---

async function readEvents(): Promise<Record<string, EventWithAvailability>> {
  if (useRedis()) {
    const redis = Redis.fromEnv();
    const raw = await redis.get<string>(STORAGE_KEY);
    if (raw == null) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  return readEventsSync();
}

async function writeEvents(
  events: Record<string, EventWithAvailability>
): Promise<void> {
  if (useRedis()) {
    const redis = Redis.fromEnv();
    await redis.set(STORAGE_KEY, JSON.stringify(events));
    return;
  }
  writeEventsSync(events);
}

export async function createEvent(
  event: EventWithAvailability
): Promise<EventWithAvailability> {
  const events = await readEvents();
  events[event.id] = event;
  await writeEvents(events);
  return event;
}

export async function getEvent(
  id: string
): Promise<EventWithAvailability | null> {
  const events = await readEvents();
  return events[id] ?? null;
}

export async function addAvailability(
  eventId: string,
  participantName: string,
  slots: string[],
  slotsPrefer: string[] = [],
  timezone?: string
): Promise<EventWithAvailability | null> {
  const events = await readEvents();
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
  await writeEvents(events);
  return event;
}
