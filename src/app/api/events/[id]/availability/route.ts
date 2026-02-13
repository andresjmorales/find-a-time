import { NextRequest, NextResponse } from "next/server";
import { addAvailability } from "@/lib/store";

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
    const event = await addAvailability(
      id,
      participantName,
      slots,
      ifNeeded,
      timezone,
      otherAvailabilityNote
    );
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (err) {
    console.error("Add availability failed:", err);
    return NextResponse.json(
      { error: "Storage unavailable. Configure Upstash Redis for production." },
      { status: 503 }
    );
  }
}
