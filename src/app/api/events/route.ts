import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createEvent, getEvent } from "@/lib/store";
import { EventWithAvailability } from "@/lib/types";

/** URL-safe short ID (8 chars), e.g. fM9aLK4v */
function generateShortId(): string {
  return randomBytes(6).toString("base64url");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, dates, startHour, endHour, eventTimezone } = body;

  if (!name || !dates?.length || startHour == null || endHour == null) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  let id = generateShortId();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await getEvent(id))) break;
    id = generateShortId();
  }

  const event: EventWithAvailability = {
    id,
    name,
    dates: dates.sort(),
    startHour,
    endHour,
    eventTimezone: eventTimezone || undefined,
    createdAt: new Date().toISOString(),
    availability: [],
  };

  try {
    await createEvent(event);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("Create event failed:", err);
    return NextResponse.json(
      {
        error:
          "Storage unavailable. Add Upstash Redis (Storage) to your Vercel project and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      },
      { status: 503 }
    );
  }
}
