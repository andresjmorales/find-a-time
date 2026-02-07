"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Please enter an event name");
      return;
    }
    if (dates.length === 0) {
      setError("Please select at least one date");
      return;
    }
    if (startHour >= endHour) {
      setError("End time must be after start time");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dates, startHour, endHour }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      const event = await res.json();
      router.push(`/event/${event.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function formatHour(hour: number): string {
    const ampm = hour >= 12 ? "PM" : "AM";
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h}:00 ${ampm}`;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find a Time</h1>
        <p className="text-gray-600">
          Create an event and share it with your group to find the best meeting
          time.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Team Standup, Dinner Plans"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What dates might work?
          </label>
          <div className="flex justify-center">
            <DatePicker selectedDates={dates} onDatesChange={setDates} />
          </div>
          {dates.length > 0 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              {dates.length} date{dates.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What hours might work?
          </label>
          <div className="flex items-center gap-3">
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
            <span className="text-gray-500 font-medium">to</span>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-gray-900"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Event"}
        </button>
      </div>
    </div>
  );
}
