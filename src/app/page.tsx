"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";

function getDefaultDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
}

function getCreatorTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "UTC";
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("Meet");
  const [dates, setDates] = useState<string[]>(() => getDefaultDates());
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [creatorTimezone, setCreatorTimezone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCreatorTimezone(getCreatorTimezone());
  }, []);

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  async function handleFindATime() {
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
        body: JSON.stringify({
          name: name.trim() || "Meet",
          dates,
          startHour,
          endHour,
          eventTimezone: creatorTimezone || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/event/${data.id}`);
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
    <div className="w-full max-w-lg mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 tracking-tight">
          Find a time
        </h1>
        <p className="text-slate-600">
          Create a link, share it, and see when everyone can meet.
        </p>
      </div>

      {/* Calendar — always visible, next 7 days pre-selected */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What dates might work?
        </label>
        <div className="flex justify-center">
          <DatePicker selectedDates={dates} onDatesChange={setDates} />
        </div>
        {dates.length > 0 && (
          <p className="text-sm text-slate-500 mt-2 text-center">
            {dates.length} date{dates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Event name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Event name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Team standup"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
        />
      </div>

      {/* Hours + creator time zone */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What hours might work?
        </label>
        {creatorTimezone && (
          <p className="text-xs text-slate-500 mb-2">
            Your time zone: <span className="font-medium text-slate-600">{creatorTimezone}</span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
          <span className="text-slate-500">–</span>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
          >
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Find a time — under the calendar view */}
      <button
        onClick={handleFindATime}
        disabled={loading}
        className="w-full py-4 px-6 bg-violet-600 text-white text-lg font-semibold rounded-2xl shadow-lg shadow-violet-600/25 hover:bg-violet-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating…" : "Find a time!"}
      </button>
    </div>
  );
}
