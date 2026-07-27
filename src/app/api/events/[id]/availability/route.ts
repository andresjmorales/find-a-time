import { NextRequest, NextResponse } from "next/server";
import { addAvailability, getEvent } from "@/lib/store";
import {
  MAX_OTHER_NOTE_LENGTH,
  MAX_PARTICIPANT_NAME_LENGTH,
  buildValidSlotSet,
  filterValidSlots,
  isEventExpired,
  isValidTimeZone,
  normalizeParticipantName,
} from "@/lib/eventTime";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantName = normalizeParticipantName(
    typeof body.participantName === "string" ? body.participantName : ""
  );
  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : undefined;
  const otherAvailabilityNote =
    typeof body.otherAvailabilityNote === "string"
      ? body.otherAvailabilityNote.trim()
      : undefined;

  if (!participantName || !Array.isArray(body.slots)) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (participantName.length > MAX_PARTICIPANT_NAME_LENGTH) {
    return NextResponse.json(
      {
        error: `Name must be at most ${MAX_PARTICIPANT_NAME_LENGTH} characters`,
      },
      { status: 400 }
    );
  }

  if (
    otherAvailabilityNote &&
    otherAvailabilityNote.length > MAX_OTHER_NOTE_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Other availability note must be at most ${MAX_OTHER_NOTE_LENGTH} characters`,
      },
      { status: 400 }
    );
  }

  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
  }

  try {
    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (isEventExpired(event)) {
      return NextResponse.json(
        { error: "This survey has expired." },
        { status: 410 }
      );
    }

    const validSlots = buildValidSlotSet(
      event.dates,
      event.startHour,
      event.endHour
    );
    const slots = filterValidSlots(body.slots, validSlots);
    const ifNeededRaw = Array.isArray(body.slotsIfNeeded)
      ? body.slotsIfNeeded
      : Array.isArray(body.slotsPrefer)
        ? body.slotsPrefer
        : [];
    // "If needed" is ignored when the event disables it; also drop overlaps with Great.
    const ifNeeded = event.disableIfNeeded
      ? []
      : filterValidSlots(ifNeededRaw, validSlots).filter((s) => !slots.includes(s));

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
    const message = err instanceof Error ? err.message : "";
    if (message === "Could not acquire event lock") {
      return NextResponse.json(
        { error: "Too many simultaneous submissions. Please try again." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Storage unavailable. Configure Upstash Redis for production." },
      { status: 503 }
    );
  }
}
