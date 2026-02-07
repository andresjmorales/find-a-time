"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import { EventWithAvailability } from "@/lib/types";
import { getTimezoneOptions } from "@/lib/timezones";

function getDefaultTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "UTC";
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
  const [slotsPrefer, setSlotsPrefer] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<"respond" | "results">("respond");
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
          slotsPrefer: slotsPrefer.length ? slotsPrefer : undefined,
          otherAvailabilityNote: otherAvailabilityNote.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

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
          Find a time
        </a>
      </div>
    );
  }

  if (!event) return null;

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

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab("respond")}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === "respond"
              ? "bg-white text-slate-900 shadow-sm"
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

      {tab === "respond" && (
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
                  setSlotsPrefer([]);
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
                  Grid times are in event timezone{event.eventTimezone ? ` (${event.eventTimezone})` : ""}. Your selection is stored in that same timezone.
                </p>
              </div>

              <p className="text-sm text-slate-600 mb-3">
                Click or drag to mark times: <strong>Great</strong>,{" "}
                <strong>If needed</strong>, or <strong>Unavailable</strong>.
              </p>

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                slotsGreat={slotsGreat}
                slotsPrefer={slotsPrefer}
                onSlotsChange={({ great, prefer }) => {
                  setSlotsGreat(great);
                  setSlotsPrefer(prefer);
                }}
                mode="input"
                othersAvailability={event.availability.map((a) => ({
                  slots: a.slots,
                  slotsPrefer: a.slotsPrefer,
                }))}
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
                  If some of your available times don’t align to the grid above, note them here. They’ll show at the bottom of Group results.
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
          {event.availability.length === 0 ? (
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

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                availability={event.availability}
                mode="view"
              />

              {event.availability.some((a) => a.otherAvailabilityNote) && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Other availability</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {event.availability
                      .filter((a) => a.otherAvailabilityNote)
                      .map((a) => (
                        <li key={a.participantName}>
                          <strong>{a.participantName}</strong>
                          {a.timezone ? ` (${a.timezone})` : ""} had other availability: {a.otherAvailabilityNote}
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
