import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { EventWithAvailability, Availability } from "./types";
import { sameParticipant } from "./eventTime";

const LEGACY_STORAGE_KEY = "find-a-time:events";
const EVENT_KEY_PREFIX = "find-a-time:event:";

function eventKey(id: string): string {
  return `${EVENT_KEY_PREFIX}${id}`;
}

/** Normalize stored events so availability always has slotsIfNeeded (backward compat for slotsPrefer). */
function normalizeEvent(e: Record<string, unknown>): EventWithAvailability {
  const availabilityRaw = Array.isArray(e.availability) ? e.availability : [];
  return {
    ...(e as unknown as EventWithAvailability),
    availability: availabilityRaw.map((raw) => {
      const a = (raw ?? {}) as Record<string, unknown>;
      return {
        participantName: String(a.participantName ?? ""),
        timezone: typeof a.timezone === "string" ? a.timezone : undefined,
        slots: Array.isArray(a.slots) ? (a.slots as string[]) : [],
        slotsIfNeeded: Array.isArray(a.slotsIfNeeded)
          ? (a.slotsIfNeeded as string[])
          : Array.isArray(a.slotsPrefer)
            ? (a.slotsPrefer as string[])
            : undefined,
        otherAvailabilityNote:
          typeof a.otherAvailabilityNote === "string"
            ? a.otherAvailabilityNote
            : undefined,
      };
    }),
  };
}

function normalizeEvents(
  events: Record<string, unknown>
): Record<string, EventWithAvailability> {
  const result: Record<string, EventWithAvailability> = {};
  for (const id of Object.keys(events)) {
    result[id] = normalizeEvent(events[id] as Record<string, unknown>);
  }
  return result;
}

/** Supports both Upstash (UPSTASH_*) and Vercel KV (KV_REST_API_*) env names */
function hasRedisConfig(): boolean {
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

function parseStored(raw: unknown): EventWithAvailability | null {
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return normalizeEvent(parsed as Record<string, unknown>);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Migrate one event out of the legacy all-events blob into a per-event key.
 * Safe to call concurrently; last writer wins for the per-event key (same data).
 */
async function migrateLegacyEvent(
  redis: Redis,
  id: string
): Promise<EventWithAvailability | null> {
  const raw = await redis.get(LEGACY_STORAGE_KEY);
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw as string) : raw;
  const events = normalizeEvents(parsed as Record<string, unknown>);
  const event = events[id];
  if (!event) return null;
  await redis.set(eventKey(id), JSON.stringify(event));
  return event;
}

async function readEventRedis(id: string): Promise<EventWithAvailability | null> {
  const redis = getRedis();
  const raw = await redis.get(eventKey(id));
  const direct = parseStored(raw);
  if (direct) return direct;
  return migrateLegacyEvent(redis, id);
}

async function writeEventRedis(event: EventWithAvailability): Promise<void> {
  const redis = getRedis();
  await redis.set(eventKey(event.id), JSON.stringify(event));
}

/**
 * Acquire a short-lived lock so concurrent availability writes for the same
 * event don't clobber each other (classic read-modify-write race).
 */
async function withEventLock<T>(
  id: string,
  fn: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  const lockKey = `${EVENT_KEY_PREFIX}lock:${id}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const locked = await redis.set(lockKey, "1", { nx: true, px: 4000 });
    if (locked) {
      try {
        return await fn();
      } finally {
        await redis.del(lockKey);
      }
    }
    await sleep(40 + attempt * 30);
  }
  throw new Error("Could not acquire event lock");
}

export async function createEvent(
  event: EventWithAvailability
): Promise<EventWithAvailability> {
  if (hasRedisConfig()) {
    const redis = getRedis();
    // NX: refuse to overwrite if an ID somehow already exists
    const ok = await redis.set(eventKey(event.id), JSON.stringify(event), {
      nx: true,
    });
    if (!ok) {
      throw new Error("Event ID collision");
    }
    return event;
  }

  const events = readEventsSync();
  if (events[event.id]) {
    throw new Error("Event ID collision");
  }
  events[event.id] = event;
  writeEventsSync(events);
  return event;
}

export async function getEvent(
  id: string
): Promise<EventWithAvailability | null> {
  if (hasRedisConfig()) {
    return readEventRedis(id);
  }
  const events = readEventsSync();
  return events[id] ?? null;
}

function applyAvailability(
  event: EventWithAvailability,
  participantName: string,
  slots: string[],
  slotsIfNeeded: string[],
  timezone?: string,
  otherAvailabilityNote?: string
): EventWithAvailability {
  const entry: Availability = {
    participantName,
    timezone,
    slots,
    slotsIfNeeded: slotsIfNeeded.length ? slotsIfNeeded : undefined,
    otherAvailabilityNote: otherAvailabilityNote?.trim() || undefined,
  };

  return {
    ...event,
    availability: [
      ...event.availability.filter(
        (a) => !sameParticipant(a.participantName, participantName)
      ),
      entry,
    ],
  };
}

export async function addAvailability(
  eventId: string,
  participantName: string,
  slots: string[],
  slotsIfNeeded: string[] = [],
  timezone?: string,
  otherAvailabilityNote?: string
): Promise<EventWithAvailability | null> {
  if (hasRedisConfig()) {
    return withEventLock(eventId, async () => {
      const event = await readEventRedis(eventId);
      if (!event) return null;
      const updated = applyAvailability(
        event,
        participantName,
        slots,
        slotsIfNeeded,
        timezone,
        otherAvailabilityNote
      );
      await writeEventRedis(updated);
      return updated;
    });
  }

  const events = readEventsSync();
  const event = events[eventId];
  if (!event) return null;
  const updated = applyAvailability(
    event,
    participantName,
    slots,
    slotsIfNeeded,
    timezone,
    otherAvailabilityNote
  );
  events[eventId] = updated;
  writeEventsSync(events);
  return updated;
}
