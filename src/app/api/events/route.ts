import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createEvent, getEvent } from "@/lib/store";
import { EventWithAvailability } from "@/lib/types";
import {
  MAX_EVENT_DATES,
  MAX_EVENT_NAME_LENGTH,
  isValidDateString,
  isValidTimeZone,
} from "@/lib/eventTime";

/** URL-safe short ID (8 chars), e.g. fM9aLK4v */
function generateShortId(): string {
  return randomBytes(6).toString("base64url");
}

function isValidExpiresAt(value: string): boolean {
  if (isValidDateString(value)) return true;
  if (!value.includes("T")) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const datesRaw = body.dates;
  const startHour = Number(body.startHour);
  const endHour = Number(body.endHour);
  const eventTimezone =
    typeof body.eventTimezone === "string" && body.eventTimezone.trim()
      ? body.eventTimezone.trim()
      : undefined;
  const disableIfNeeded = !!body.disableIfNeeded;
  const ifNeededWeight =
    body.ifNeededWeight != null ? Number(body.ifNeededWeight) : undefined;
  const expiresAtRaw =
    typeof body.expiresAt === "string" && body.expiresAt.trim()
      ? body.expiresAt.trim()
      : undefined;
  const hideResultsUntilExpiration = !!body.hideResultsUntilExpiration;

  if (!nameRaw || !Array.isArray(datesRaw) || datesRaw.length === 0) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (nameRaw.length > MAX_EVENT_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Event name must be at most ${MAX_EVENT_NAME_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 1 ||
    endHour > 23 ||
    startHour >= endHour
  ) {
    return NextResponse.json(
      { error: "Invalid time range: end must be after start" },
      { status: 400 }
    );
  }

  if (datesRaw.length > MAX_EVENT_DATES) {
    return NextResponse.json(
      { error: `Select at most ${MAX_EVENT_DATES} dates` },
      { status: 400 }
    );
  }

  const dates = [
    ...new Set(
      datesRaw.filter(
        (d): d is string => typeof d === "string" && isValidDateString(d)
      )
    ),
  ].sort();

  if (dates.length === 0) {
    return NextResponse.json(
      { error: "Please provide at least one valid date" },
      { status: 400 }
    );
  }

  if (!isValidTimeZone(eventTimezone)) {
    return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
  }

  if (expiresAtRaw && !isValidExpiresAt(expiresAtRaw)) {
    return NextResponse.json(
      { error: "Invalid expiration date" },
      { status: 400 }
    );
  }

  let id = "";
  let allocated = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    id = generateShortId();
    if (!(await getEvent(id))) {
      allocated = true;
      break;
    }
  }
  if (!allocated) {
    return NextResponse.json(
      { error: "Could not allocate a unique event id. Please try again." },
      { status: 503 }
    );
  }

  const event: EventWithAvailability = {
    id,
    name: nameRaw,
    dates,
    startHour,
    endHour,
    eventTimezone,
    createdAt: new Date().toISOString(),
    availability: [],
    disableIfNeeded: disableIfNeeded || undefined,
    ifNeededWeight:
      !disableIfNeeded &&
      ifNeededWeight != null &&
      Number.isFinite(ifNeededWeight)
        ? Math.max(0, Math.min(1, ifNeededWeight))
        : undefined,
    expiresAt: expiresAtRaw,
    hideResultsUntilExpiration:
      !!expiresAtRaw && hideResultsUntilExpiration ? true : undefined,
  };

  try {
    await createEvent(event);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("Create event failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (message === "Event ID collision") {
      return NextResponse.json(
        { error: "Could not allocate a unique event id. Please try again." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Storage unavailable. Add Upstash Redis (Storage) to your Vercel project and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      },
      { status: 503 }
    );
  }
}
