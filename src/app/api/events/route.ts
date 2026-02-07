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

  createEvent(event);

  return NextResponse.json(event, { status: 201 });
}
