import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { EventWithAvailability } from "./types";

const STORAGE_KEY = "find-a-time:events";

/** Normalize stored events so availability always has slotsIfNeeded (backward compat for slotsPrefer). */
function normalizeEvents(events: Record<string, unknown>): Record<string, EventWithAvailability> {
  const result: Record<string, EventWithAvailability> = {};
  for (const id of Object.keys(events)) {
    const e = events[id] as any;
    result[id] = {
      ...e,
      availability: (e?.availability || []).map((a: any) => ({
        participantName: a.participantName,
        timezone: a.timezone,
        slots: a.slots || [],
        slotsIfNeeded: a.slotsIfNeeded ?? a.slotsPrefer,
        otherAvailabilityNote: a.otherAvailabilityNote,
      })),
    };
  }
  return result;
}

/** Supports both Upstash (UPSTASH_*) and Vercel KV (KV_REST_API_*) env names */
function useRedis(): boolean {
  return !!(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

function getRedis(): Redis {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  throw new Error("Redis env vars not set");
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
  return normalizeEvents(JSON.parse(raw));
}

function writeEventsSync(events: Record<string, EventWithAvailability>) {
  ensureDataDir();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

// --- Async store API (Redis when on Vercel with env; else file) ---

async function readEvents(): Promise<Record<string, EventWithAvailability>> {
  if (useRedis()) {
    const redis = getRedis();
    const raw = await redis.get<string>(STORAGE_KEY);
    if (raw == null) return {};
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizeEvents(parsed);
  }
  return readEventsSync();
}

async function writeEvents(
  events: Record<string, EventWithAvailability>
): Promise<void> {
  if (useRedis()) {
    const redis = getRedis();
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
  slotsIfNeeded: string[] = [],
  timezone?: string,
  otherAvailabilityNote?: string
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
    slotsIfNeeded: slotsIfNeeded?.length ? slotsIfNeeded : undefined,
    otherAvailabilityNote:
      otherAvailabilityNote?.trim() || undefined,
  });
  await writeEvents(events);
  return event;
}
