import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createEvent } from "@/lib/store";
import { EventWithAvailability } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, dates, startHour, endHour } = body;

  if (!name || !dates?.length || startHour == null || endHour == null) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const event: EventWithAvailability = {
    id: uuidv4(),
    name,
    dates: dates.sort(),
    startHour,
    endHour,
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
