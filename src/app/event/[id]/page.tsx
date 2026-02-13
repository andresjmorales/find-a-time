"use client";

import { useState, useEffect, useCallback, useMemo, useMemo as useReactMemo } from "react";
import { useParams } from "next/navigation";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import { EventWithAvailability } from "@/lib/types";
import { getTimezoneOptions } from "@/lib/timezones";
import { getSlotScoreValue, DEFAULT_IF_NEEDED_WEIGHT } from "@/lib/scoring";

function getDefaultTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "UTC";
}

function slotKey(date: string, hour: number, half: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${half === 0 ? "00" : "30"}`;
}

function parseSlot(slot: string): { date: string; hour: number; minute: number } {
  const [date, time] = slot.split("T");
  const [hourStr, minuteStr] = time.split(":");
  return {
    date,
    hour: Number(hourStr),
    minute: Number(minuteStr),
  };
}

function formatSlotLabel(slot: string): string {
  const { date, hour, minute } = parseSlot(slot);
  const dateObj = new Date(date + "T12:00:00");

  const dateLabel = dateObj.toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });

  const ampm = hour >= 12 ? "PM" : "AM";
  let displayHour = hour % 12;
  if (displayHour === 0) displayHour = 12;
  const minuteStr = minute === 0 ? "00" : "30";

  return `${dateLabel} @ ${displayHour}:${minuteStr} ${ampm}`;
}

function computeTopSlots(event: EventWithAvailability): {
  slot: string;
  label: string;
  score: number;
  availableCount: number;
  totalParticipants: number;
}[] {
  if (!event.availability.length) return [];

  const { dates, startHour, endHour, disableIfNeeded, ifNeededWeight } = event;
  const totalParticipants = event.availability.length;
  const weight = disableIfNeeded ? 0 : (ifNeededWeight ?? DEFAULT_IF_NEEDED_WEIGHT);

  const scored: {
    slot: string;
    score: number;
    availableCount: number;
    great: number;
  }[] = [];

  for (const date of dates) {
    for (let hour = startHour; hour < endHour; hour++) {
      for (const half of [0, 1] as const) {
        const slot = slotKey(date, hour, half);
        let great = 0;
        let ifNeeded = 0;

        for (const a of event.availability) {
          if (a.slots.includes(slot)) great++;
          else if (a.slotsIfNeeded?.includes(slot)) ifNeeded++;
        }

        const availableCount = great + ifNeeded;
        if (availableCount === 0) continue;

        const score = getSlotScoreValue(great, ifNeeded, weight);
        scored.push({ slot, score, availableCount, great });
      }
    }
  }

  if (!scored.length) return [];

  // Sort: by score (desc), then by total available people (desc), then great count (desc), then slot
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
    if (b.great !== a.great) return b.great - a.great;
    return a.slot.localeCompare(b.slot);
  });

  const top = scored.slice(0, 3);

  return top.map((s) => ({
    slot: s.slot,
    label: formatSlotLabel(s.slot),
    score: s.score,
    availableCount: s.availableCount,
    totalParticipants,
  }));
}

export default function EventPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventWithAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [participantName, setParticipantName] = useState("");
  const [timezone, setTimezone] = useState(() => getDefaultTimezone());
  const [otherAvailabilityNote, setOtherAvailabilityNote] = useState("");
  const [slotsGreat, setSlotsGreat] = useState<string[]>([]);
  const [slotsIfNeeded, setSlotsIfNeeded] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<"respond" | "results">("respond");

  // When event loads and is expired or results hidden, default to results tab
  useEffect(() => {
    if (!event) return;
    const exp = event.expiresAt
      ? new Date(
          event.expiresAt.includes("T") ? event.expiresAt : event.expiresAt + "T23:59:59"
        )
      : null;
    const expired = !!exp && new Date() > exp;
    const hideRes =
      !!event.hideResultsUntilExpiration && !!exp && !expired;
    if (expired || hideRes) setTab("results");
  }, [event?.id, event?.expiresAt, event?.hideResultsUntilExpiration]);
  const timezoneOptions = useMemo(
    () => getTimezoneOptions(timezone),
    [timezone]
  );

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) throw new Error("Event not found");
      const data = await res.json();
      setEvent(data);
    } catch {
      setError("Event not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Keep tab title in sync when event loads (e.g. after client fetch)
  useEffect(() => {
    if (!event?.name) return;
    const title = `Let's Find a Time! — ${event.name}`;
    document.title = title;
    return () => {
      document.title = "Let's Find a Time!";
    };
  }, [event?.name]);

  const topSlots = useReactMemo(
    () => (event ? computeTopSlots(event) : []),
    [event]
  );

  async function handleSubmit() {
    if (!participantName.trim()) {
      setError("Please enter your name");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${id}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantName: participantName.trim(),
          timezone: timezone || undefined,
          slots: slotsGreat,
          slotsIfNeeded: slotsIfNeeded.length ? slotsIfNeeded : undefined,
          otherAvailabilityNote: otherAvailabilityNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 410) {
          setError("This survey has expired.");
          fetchEvent();
          return;
        }
        throw new Error((data.error as string) || "Failed to submit");
      }

      const updated = await res.json();
      setEvent(updated);
      setSubmitted(true);
      setTab("results");
    } catch {
      setError("Failed to submit availability. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-slate-500">Loading event…</div>
    );
  }

  if (error && !event) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <a href="/" className="text-violet-600 hover:underline">
          Let's Find a Time!
        </a>
      </div>
    );
  }

  if (!event) return null;

  const now = new Date();
  const expiresAtDate = event.expiresAt
    ? new Date(event.expiresAt.includes("T") ? event.expiresAt : event.expiresAt + "T23:59:59")
    : null;
  const isExpired = !!expiresAtDate && now > expiresAtDate;
  const hideResults =
    !!event.hideResultsUntilExpiration && !!expiresAtDate && !isExpired;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{event.name}</h1>
        <p className="text-slate-500 text-sm">
          {event.dates.length} day{event.dates.length !== 1 ? "s" : ""} ·{" "}
          {formatHour(event.startHour)} – {formatHour(event.endHour)}
          {event.eventTimezone && (
            <> · Times in <span className="font-medium text-slate-600">{event.eventTimezone}</span></>
          )}
          {event.availability.length > 0 && (
            <> · {event.availability.length} response{event.availability.length !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Share link — one tap copy */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-slate-600 flex-1 min-w-0">
            Share this link so others can add their availability:
          </p>
          <button
            onClick={copyLink}
            className="px-4 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors shrink-0"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {isExpired && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          This survey has expired. You can still view group results below.
        </div>
      )}

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => !isExpired && setTab("respond")}
          disabled={isExpired}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === "respond"
              ? "bg-white text-slate-900 shadow-sm"
              : isExpired
                ? "text-slate-400 cursor-not-allowed"
                : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Add your availability
        </button>
        <button
          onClick={() => setTab("results")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === "results"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Group results
        </button>
      </div>

      {tab === "respond" && !isExpired && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✓</div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Availability submitted
              </h2>
              <p className="text-slate-500 mb-4">
                Saved as <strong>{participantName}</strong>.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setParticipantName("");
                  setOtherAvailabilityNote("");
                  setSlotsGreat([]);
                  setSlotsIfNeeded([]);
                }}
                className="text-violet-600 hover:underline text-sm"
              >
                Submit as someone else
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full max-w-xs px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your time zone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full max-w-md px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
                >
                  {timezoneOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Grid times are in event timezone
                  {event.eventTimezone ? ` (${event.eventTimezone})` : ""}. Your selection is
                  stored in that same timezone.
                </p>
              </div>

              <p className="text-sm text-slate-600 mb-3">
                {event.disableIfNeeded
                  ? "Click or drag to mark times: Great or Unavailable. On touch screens: hold 1 second on a cell, then drag to paint multiple."
                  : "Click or drag to mark times: Great, If needed, or Unavailable. On touch screens: hold 1 second on a cell, then drag to paint multiple."}
              </p>

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                slotsGreat={slotsGreat}
                slotsIfNeeded={slotsIfNeeded}
                onSlotsChange={({ great, ifNeeded }) => {
                  setSlotsGreat(great);
                  setSlotsIfNeeded(ifNeeded);
                }}
                mode="input"
                othersAvailability={event.availability.map((a) => ({
                  slots: a.slots,
                  slotsIfNeeded: a.slotsIfNeeded,
                }))}
                disableIfNeeded={event.disableIfNeeded}
                ifNeededWeight={event.ifNeededWeight}
              />

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Other availability <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={otherAvailabilityNote}
                  onChange={(e) => setOtherAvailabilityNote(e.target.value)}
                  placeholder="e.g. Friday 2–4pm my time, if that doesn't fit the grid"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
                />
                <p className="text-xs text-slate-500 mt-1">
                  If some of your available times don’t align to the grid above, note them here.
                  They’ll show at the bottom of Group results.
                </p>
              </div>

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-6 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit availability"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {hideResults ? (
            <div className="text-center py-8 text-slate-500">
              <p>Results are hidden until after the survey expires ({event.expiresAt}).</p>
            </div>
          ) : event.availability.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No responses yet. Share the link to get started.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Group availability
                </h2>
                <p className="text-sm text-slate-500">
                  {event.availability.length} response
                  {event.availability.length !== 1 ? "s" : ""}:{" "}
                  {event.availability
                    .map(
                      (a) =>
                        a.timezone
                          ? `${a.participantName} (${a.timezone})`
                          : a.participantName
                    )
                    .join(", ")}
                </p>
              </div>

              {topSlots.length > 0 && (
                <div className="mb-5 rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">
                    Recommended times
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-800">
                    {topSlots.map((slot, index) => (
                      <li key={slot.slot}>
                        <span className={index === 0 ? "font-semibold" : ""}>
                          {slot.label}
                        </span>{" "}
                        <span className="text-slate-500">
                          (works for {slot.availableCount}/{slot.totalParticipants})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                availability={event.availability}
                mode="view"
                disableIfNeeded={event.disableIfNeeded}
                ifNeededWeight={event.ifNeededWeight}
              />

              {event.availability.some((a) => a.otherAvailabilityNote) && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Other availability
                  </h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {event.availability
                      .filter((a) => a.otherAvailabilityNote)
                      .map((a) => (
                        <li key={a.participantName}>
                          <strong>{a.participantName}</strong>
                          {a.timezone ? ` (${a.timezone})` : ""} had other availability:{" "}
                          {a.otherAvailabilityNote}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:00 ${ampm}`;
}

