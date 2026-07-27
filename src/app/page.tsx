"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import { getTimezoneOptions } from "@/lib/timezones";
import { MAX_EVENT_DATES } from "@/lib/eventTime";

/** Number of preset days selected by default: today plus the next 2 days (3 days total). */
export const DEFAULT_PRESET_DAYS_COUNT = 3;

/** Maximum number of dates the user can select (easy to change for future use cases). */
export const MAX_PRESET_DAYS_LIMIT = MAX_EVENT_DATES;

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDefaultDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < DEFAULT_PRESET_DAYS_COUNT; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    dates.push(formatLocalDate(d));
  }
  return dates;
}

function getCreatorTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return "UTC";
}

function subscribeNoop(): () => void {
  return () => {};
}

/** Stable snapshot for useSyncExternalStore (must not allocate a new array each read). */
let cachedDefaultDatesDay = "";
let cachedDefaultDates: string[] = [];
function getDefaultDatesSnapshot(): string[] {
  const today = formatLocalDate(new Date());
  if (cachedDefaultDatesDay === today && cachedDefaultDates.length > 0) {
    return cachedDefaultDates;
  }
  cachedDefaultDatesDay = today;
  cachedDefaultDates = getDefaultDates();
  return cachedDefaultDates;
}

const EMPTY_DATES: string[] = [];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("Party");
  // Client-only defaults via useSyncExternalStore (avoids SSR baking build-time dates/TZ).
  const defaultDates = useSyncExternalStore(
    subscribeNoop,
    getDefaultDatesSnapshot,
    () => EMPTY_DATES
  );
  const [datesOverride, setDatesOverride] = useState<string[] | null>(null);
  const dates = datesOverride ?? defaultDates;
  const setDates = (next: string[]) => setDatesOverride(next);

  const detectedTimezone = useSyncExternalStore(
    subscribeNoop,
    getCreatorTimezone,
    () => ""
  );
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);
  const selectedTimezone = timezoneOverride ?? detectedTimezone;

  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [disableIfNeeded, setDisableIfNeeded] = useState(false);
  const [ifNeededWeight, setIfNeededWeight] = useState(0.8);
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [hideResultsUntilExpiration, setHideResultsUntilExpiration] = useState(false);

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  const creatorTimezoneOptions = useMemo(() => {
    const opts = getTimezoneOptions(selectedTimezone);
    if (!selectedTimezone) return [{ value: "", label: "Your time zone…" }, ...opts];
    return opts;
  }, [selectedTimezone]);

  async function handleFindATime() {
    if (dates.length === 0) {
      setError("Please select at least one date");
      return;
    }
    if (startHour >= endHour) {
      setError("End time must be after start time");
      return;
    }
    if (expirationEnabled && !expiresAt.trim()) {
      setError("Please set an expiration date or disable expiration");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Party",
          dates,
          startHour,
          endHour,
          eventTimezone: selectedTimezone || undefined,
          disableIfNeeded: disableIfNeeded || undefined,
          ifNeededWeight: disableIfNeeded ? undefined : ifNeededWeight,
          expiresAt: expirationEnabled && expiresAt ? expiresAt : undefined,
          hideResultsUntilExpiration:
            expirationEnabled && hideResultsUntilExpiration ? true : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(
        selectedTimezone
          ? `/event/${data.id}?tz=${encodeURIComponent(selectedTimezone)}`
          : `/event/${data.id}`
      );
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
          Let’s Find a Time!
        </h1>
        <p className="text-slate-600">
          Create a link, share it, and see when everyone can meet.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What dates might work?
        </label>
        <div className="flex justify-center">
          <DatePicker
            selectedDates={dates}
            onDatesChange={setDates}
            maxDates={MAX_PRESET_DAYS_LIMIT}
          />
        </div>
        {dates.length > 0 && (
          <p className="text-sm text-slate-500 mt-2 text-center">
            {dates.length} date{dates.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          What hours might work?
        </label>
        <p className="text-xs text-slate-500 mb-2">
          These times are the time boundaries for the poll. You’ll select your own availability on the next page.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <span className="block text-xs text-slate-500 mb-1">No earlier than</span>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-500 pt-5">–</span>
          <div className="flex-1">
            <span className="block text-xs text-slate-500 mb-1">No later than</span>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <span className="block text-xs text-slate-500 mb-1">Your time zone</span>
          <select
            value={selectedTimezone}
            onChange={(e) => setTimezoneOverride(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
          >
            {creatorTimezoneOptions.map((opt) => (
              <option key={opt.value || "placeholder"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Event name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Meet at the dog park"
          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-slate-900"
        />
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleFindATime}
        disabled={loading}
        className="w-full py-4 px-6 bg-violet-600 text-white text-lg font-semibold rounded-2xl shadow-lg shadow-violet-600/25 hover:bg-violet-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating…" : "Let’s Find a Time!"}
      </button>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium focus:outline-none focus:underline"
        >
          {advancedOpen ? "Hide advanced settings" : "Advanced settings"}
        </button>
        {advancedOpen && (
          <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="disable-if-needed"
                checked={disableIfNeeded}
                onChange={(e) => setDisableIfNeeded(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="disable-if-needed" className="text-sm font-medium text-slate-700">
                Disable &quot;If needed&quot; option
              </label>
            </div>
            <div className={disableIfNeeded ? "opacity-60 pointer-events-none" : ""}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Relative weight of &quot;If needed&quot; (0 = unavailable, 1 = same as Great)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={ifNeededWeight}
                  onChange={(e) => setIfNeededWeight(Number(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none bg-slate-200 accent-violet-600"
                />
                <span className="text-sm text-slate-600 w-10 tabular-nums">
                  {ifNeededWeight.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="expiration-enabled"
                checked={expirationEnabled}
                onChange={(e) => setExpirationEnabled(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="expiration-enabled" className="text-sm font-medium text-slate-700">
                Set expiration date
              </label>
            </div>
            {expirationEnabled && (
              <div className="pl-6 space-y-2">
                <div>
                  <label htmlFor="expires-at" className="block text-sm font-medium text-slate-700 mb-1">
                    Expiration date
                  </label>
                  <input
                    type="date"
                    id="expires-at"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hide-results-until-expiration"
                    checked={hideResultsUntilExpiration}
                    onChange={(e) => setHideResultsUntilExpiration(e.target.checked)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label
                    htmlFor="hide-results-until-expiration"
                    className="text-sm text-slate-700"
                  >
                    Hide group results until after expiration
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
