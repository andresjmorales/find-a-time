import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (err) {
    console.error("Get event failed:", err);
    return NextResponse.json(
      { error: "Storage unavailable. Configure Upstash Redis for production." },
      { status: 503 }
    );
  }
}
