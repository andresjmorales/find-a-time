import { NextRequest, NextResponse } from "next/server";
import { addAvailability } from "@/lib/store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { participantName, slots } = body;

  if (!participantName || !slots) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const event = addAvailability(id, participantName, slots);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}
