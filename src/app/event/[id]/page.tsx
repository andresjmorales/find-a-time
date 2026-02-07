"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import { EventWithAvailability } from "@/lib/types";

export default function EventPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventWithAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [participantName, setParticipantName] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<"respond" | "results">("respond");

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
          slots: selectedSlots,
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
      <div className="text-center py-20 text-gray-500">Loading event...</div>
    );
  }

  if (error && !event) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <a href="/" className="text-emerald-600 hover:underline">
          Create a new event
        </a>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{event.name}</h1>
        <p className="text-gray-500 text-sm">
          {event.dates.length} day{event.dates.length !== 1 ? "s" : ""} &middot;{" "}
          {formatHour(event.startHour)} - {formatHour(event.endHour)}
          {event.availability.length > 0 && (
            <> &middot; {event.availability.length} response{event.availability.length !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Share link */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 flex-1">
            Share this link so others can add their availability:
          </p>
          <button
            onClick={copyLink}
            className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab("respond")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "respond"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Add Your Availability
        </button>
        <button
          onClick={() => setTab("results")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "results"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Group Results
        </button>
      </div>

      {tab === "respond" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">&#10003;</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Availability submitted!
              </h2>
              <p className="text-gray-500 mb-4">
                Your availability has been saved as {participantName}.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setParticipantName("");
                  setSelectedSlots([]);
                }}
                className="text-emerald-600 hover:underline text-sm"
              >
                Submit as a different person
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900"
                />
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Click and drag to select the times you&apos;re available:
              </p>

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
                mode="input"
              />

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-6 px-6 py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Availability"}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {event.availability.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No responses yet. Share the link to get started!</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Group Availability
                </h2>
                <p className="text-sm text-gray-500">
                  {event.availability.length} response
                  {event.availability.length !== 1 ? "s" : ""}:{" "}
                  {event.availability.map((a) => a.participantName).join(", ")}
                </p>
              </div>

              <AvailabilityGrid
                dates={event.dates}
                startHour={event.startHour}
                endHour={event.endHour}
                availability={event.availability}
                mode="view"
              />
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
