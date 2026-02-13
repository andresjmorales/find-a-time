import { NextRequest, NextResponse } from "next/server";
import { addAvailability, getEvent } from "@/lib/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { participantName, timezone, slots, slotsIfNeeded, slotsPrefer, otherAvailabilityNote } = body;
  const ifNeeded = Array.isArray(slotsIfNeeded) ? slotsIfNeeded : Array.isArray(slotsPrefer) ? slotsPrefer : [];

  if (!participantName || !Array.isArray(slots)) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.expiresAt) {
      const exp = new Date(
        event.expiresAt.includes("T") ? event.expiresAt : event.expiresAt + "T23:59:59"
      );
      if (new Date() > exp) {
        return NextResponse.json(
          { error: "This survey has expired." },
          { status: 410 }
        );
      }
    }

    const updated = await addAvailability(
      id,
      participantName,
      slots,
      ifNeeded,
      timezone,
      otherAvailabilityNote
    );
    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Add availability failed:", err);
    return NextResponse.json(
      { error: "Storage unavailable. Configure Upstash Redis for production." },
      { status: 503 }
    );
  }
}
