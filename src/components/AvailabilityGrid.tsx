"use client";

import { Fragment, useState, useCallback, useRef } from "react";
import { getSlotScoreValue } from "@/lib/scoring";

export type SlotMark = "great" | "ifNeeded" | "unavailable";

interface AvailabilityGridInputProps {
  dates: string[];
  startHour: number;
  endHour: number;
  slotsGreat: string[];
  slotsIfNeeded: string[];
  onSlotsChange: (opts: { great: string[]; ifNeeded: string[] }) => void;
  mode: "input";
  /** Other participants' availability to show as overlay underneath */
  othersAvailability?: { slots: string[]; slotsIfNeeded?: string[] }[];
}

interface GroupAvailabilityGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  availability: {
    participantName: string;
    slots: string[];
    slotsIfNeeded?: string[];
  }[];
  mode: "view";
}

type Props = AvailabilityGridInputProps | GroupAvailabilityGridProps;

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("default", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function slotKey(date: string, hour: number, half: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${half === 0 ? "00" : "30"}`;
}

export default function AvailabilityGrid(props: Props) {
  const { dates, startHour, endHour, mode } = props;
  const [isDragging, setIsDragging] = useState(false);
  const [paintAs, setPaintAs] = useState<SlotMark>("great");
  const dragApplyRef = useRef<SlotMark>("great");

  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  if (mode === "view") {
    const p = props as GroupAvailabilityGridProps;
    const totalParticipants = p.availability.length;

    function getSlotCounts(slot: string): { great: number; ifNeeded: number } {
      let great = 0;
      let ifNeeded = 0;
      for (const a of p.availability) {
        if (a.slots.includes(slot)) great++;
        else if (a.slotsIfNeeded?.includes(slot)) ifNeeded++;
      }
      return { great, ifNeeded };
    }

    function getSlotTooltipNames(slot: string): {
      great: string[];
      ifNeeded: string[];
      unavailable: string[];
    } {
      const great: string[] = [];
      const ifNeeded: string[] = [];
      for (const a of p.availability) {
        if (a.slots.includes(slot)) great.push(a.participantName);
        else if (a.slotsIfNeeded?.includes(slot)) ifNeeded.push(a.participantName);
      }
      const unavailable = p.availability
        .map((a) => a.participantName)
        .filter((n) => !great.includes(n) && !ifNeeded.includes(n));
      return { great, ifNeeded, unavailable };
    }

    // Pre-compute min/max scores across all slots with any availability
    const scoreCache = new Map<string, number>();
    let minScore = Number.POSITIVE_INFINITY;
    let maxScore = 0;

    for (const date of dates) {
      for (const hour of hours) {
        for (const half of [0, 1] as const) {
          const slot = slotKey(date, hour, half);
          const { great, ifNeeded } = getSlotCounts(slot);
          if (great === 0 && ifNeeded === 0) continue;
          const score = getSlotScoreValue(great, ifNeeded);
          scoreCache.set(slot, score);
          if (score < minScore) minScore = score;
          if (score > maxScore) maxScore = score;
        }
      }
    }

    const hasScoredSlots = maxScore > 0 && minScore !== Number.POSITIVE_INFINITY;

    function getHeatColor(score: number | undefined): string | undefined {
      if (!hasScoredSlots || score === undefined) return undefined;

      // If all non-zero slots have the same score, treat them as "best" (solid green)
      if (maxScore === minScore) {
        return "rgb(22, 163, 74)"; // green-600
      }

      const t = (score - minScore) / (maxScore - minScore); // 0 = worst, 1 = best

      // Interpolate between yellow (worst) and green (best)
      const yellow = { r: 250, g: 204, b: 21 }; // amber-400-ish
      const green = { r: 22, g: 163, b: 74 }; // green-600-ish

      const r = Math.round(yellow.r + (green.r - yellow.r) * t);
      const g = Math.round(yellow.g + (green.g - yellow.g) * t);
      const b = Math.round(yellow.b + (green.b - yellow.b) * t);

      return `rgb(${r}, ${g}, ${b})`;
    }

    return (
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-0 pt-3"
          style={{
            gridTemplateColumns: `80px repeat(${dates.length}, minmax(100px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 bg-white" />
          {dates.map((date) => (
            <div
              key={date}
              className="text-center text-xs font-medium text-slate-600 pb-2 px-1"
            >
              {formatDateHeader(date)}
            </div>
          ))}

          {hours.map((hour) =>
            [0, 1].map((half) => (
              <Fragment key={`row-${hour}-${half}`}>
                <div
                  className={`sticky left-0 z-10 bg-white text-right pr-3 text-xs text-slate-500 flex items-center justify-end h-6 ${
                    half === 0 ? "-mt-3" : ""
                  }`}
                >
                  {half === 0 ? formatHour(hour) : ""}
                </div>
                {dates.map((date) => {
                  const slot = slotKey(date, hour, half);
                  const { great, ifNeeded } = getSlotCounts(slot);
                  const score = scoreCache.get(slot);
                  const { great: greatNames, ifNeeded: ifNeededNames, unavailable: unavailableNames } =
                    getSlotTooltipNames(slot);
                  const hasAny =
                    greatNames.length || ifNeededNames.length || unavailableNames.length;
                  const heatColor = getHeatColor(score);
                  const isEmpty = !hasAny;

                  return (
                    <div
                      key={slot}
                      className={`h-6 border border-slate-200 transition-colors cursor-default group relative ${
                        isEmpty ? "bg-slate-50" : ""
                      }`}
                      style={heatColor ? { backgroundColor: heatColor } : undefined}
                    >
                      <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-2 bg-slate-800 text-white text-xs rounded shadow-lg text-left w-[max(180px,40ch)]">
                        {hasAny ? (
                          <>
                            {greatNames.length > 0 && (
                              <p className="mb-1.5 last:mb-0">
                                <span className="font-semibold text-slate-200">Great:</span>{" "}
                                <span className="text-white">{greatNames.join(", ")}</span>
                              </p>
                            )}
                            {ifNeededNames.length > 0 && (
                              <p className="mb-1.5 last:mb-0">
                                <span className="font-semibold text-slate-200">If needed:</span>{" "}
                                <span className="text-white">{ifNeededNames.join(", ")}</span>
                              </p>
                            )}
                            {unavailableNames.length > 0 && (
                              <p className="mb-0">
                                <span className="font-semibold text-slate-200">Unavailable:</span>{" "}
                                <span className="text-white">
                                  {unavailableNames.join(", ")}
                                </span>
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mb-0">No one available</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))
          )}
        </div>

        {totalParticipants > 0 && (
          <div className="flex items-center gap-3 mt-4 text-xs text-slate-600 flex-wrap">
            <span>Availability:</span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-3 bg-slate-50 border border-slate-200 rounded" />
              none
            </span>
            <span className="flex items-center gap-1">
              <span
                className="w-4 h-3 border border-slate-200 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(250, 204, 21) 0%, rgb(22, 163, 74) 100%)",
                }}
              />
              worse ⟶ better
            </span>
          </div>
        )}
      </div>
    );
  }

  // Input mode
  const p = props as AvailabilityGridInputProps;
  const others = p.othersAvailability ?? [];

  const getOthersCount = useCallback(
    (slot: string): number => {
      let n = 0;
      for (const o of others) {
        if (o.slots.includes(slot) || o.slotsIfNeeded?.includes(slot)) n++;
      }
      return n;
    },
    [others]
  );

  const handleMouseDown = useCallback(
    (slot: string) => {
      setIsDragging(true);
      dragApplyRef.current = paintAs;

      const inGreat = p.slotsGreat.includes(slot);
      const inIfNeeded = p.slotsIfNeeded.includes(slot);

      if (paintAs === "unavailable") {
        p.onSlotsChange({
          great: p.slotsGreat.filter((s) => s !== slot),
          ifNeeded: p.slotsIfNeeded.filter((s) => s !== slot),
        });
        return;
      }
      if (paintAs === "great") {
        p.onSlotsChange({
          great: inGreat
            ? p.slotsGreat.filter((s) => s !== slot)
            : [...p.slotsGreat.filter((s) => s !== slot), slot],
          ifNeeded: p.slotsIfNeeded.filter((s) => s !== slot),
        });
        return;
      }
      // ifNeeded
      p.onSlotsChange({
        great: p.slotsGreat.filter((s) => s !== slot),
        ifNeeded: inIfNeeded
          ? p.slotsIfNeeded.filter((s) => s !== slot)
          : [...p.slotsIfNeeded.filter((s) => s !== slot), slot],
      });
    },
    [paintAs, p]
  );

  const handleMouseEnter = useCallback(
    (slot: string) => {
      if (!isDragging) return;
      const mark = dragApplyRef.current;

      if (mark === "unavailable") {
        p.onSlotsChange({
          great: p.slotsGreat.filter((s) => s !== slot),
          ifNeeded: p.slotsIfNeeded.filter((s) => s !== slot),
        });
        return;
      }
      if (mark === "great") {
        if (!p.slotsGreat.includes(slot)) {
          p.onSlotsChange({
            great: [...p.slotsGreat, slot],
            ifNeeded: p.slotsIfNeeded.filter((s) => s !== slot),
          });
        }
        return;
      }
      if (!p.slotsIfNeeded.includes(slot)) {
        p.onSlotsChange({
          great: p.slotsGreat.filter((s) => s !== slot),
          ifNeeded: [...p.slotsIfNeeded, slot],
        });
      }
    },
    [isDragging, p]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const inGreat = (slot: string) => p.slotsGreat.includes(slot);
  const inIfNeeded = (slot: string) => p.slotsIfNeeded.includes(slot);
  const othersCount = others.length;

  return (
    <div
      className="overflow-x-auto select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Paint mode toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-sm text-slate-600">Mark as:</span>
        {(
          [
            { value: "great" as const, label: "Great", bg: "bg-emerald-500" },
            { value: "ifNeeded" as const, label: "If needed", bg: "bg-amber-400" },
            { value: "unavailable" as const, label: "Unavailable", bg: "bg-red-400" },
          ] as const
        ).map(({ value, label, bg }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPaintAs(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              paintAs === value
                ? `${bg} text-white ring-2 ring-offset-2 ring-slate-300`
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="relative inline-flex cursor-help group/info">
          <span
            className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-slate-400 text-slate-500 text-[10px] font-semibold"
            aria-label="How ranking works"
          >
            i
          </span>
          <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 hidden group-hover/info:block px-2.5 py-1.5 text-xs text-white bg-slate-800 rounded shadow-lg whitespace-nowrap">
            Great is weighted 1.5× more than If needed when ranking times.
          </span>
        </span>
      </div>

      <div
        className="inline-grid gap-0 relative pt-4"
        style={{
          gridTemplateColumns: `80px repeat(${dates.length}, minmax(100px, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 bg-white" />
        {dates.map((date) => (
          <div
            key={date}
            className="text-center text-xs font-medium text-slate-600 pb-2 px-1"
          >
            {formatDateHeader(date)}
          </div>
        ))}

        {hours.map((hour) =>
          [0, 1].map((half) => (
            <Fragment key={`row-${hour}-${half}`}>
              <div
                className={`sticky left-0 z-10 bg-white text-right pr-3 text-xs text-slate-500 flex items-center justify-end h-8 ${
                  half === 0 ? "-mt-4" : ""
                }`}
              >
                {half === 0 ? formatHour(hour) : ""}
              </div>
              {dates.map((date) => {
                const slot = slotKey(date, hour, half);
                const great = inGreat(slot);
                const ifNeeded = inIfNeeded(slot);
                const n = othersCount > 0 ? getOthersCount(slot) : 0;
                const overlayOpacity =
                  othersCount > 0 && n > 0
                    ? Math.min(0.15 + (n / othersCount) * 0.35, 0.5)
                    : 0;

                return (
                  <div
                    key={slot}
                    className="relative h-8 border border-slate-200 cursor-pointer transition-colors overflow-hidden"
                    onMouseDown={() => handleMouseDown(slot)}
                    onMouseEnter={() => handleMouseEnter(slot)}
                  >
                    {/* Others' availability overlay (underneath) */}
                    {overlayOpacity > 0 && (
                      <div
                        className="absolute inset-0 bg-emerald-400 pointer-events-none"
                        style={{ opacity: overlayOpacity }}
                        aria-hidden
                      />
                    )}
                    {/* Your selection on top */}
                    <div
                      className={`absolute inset-0 border border-slate-200 transition-colors ${
                        great
                          ? "bg-emerald-500"
                          : ifNeeded
                            ? "bg-amber-400"
                            : "bg-red-300/70"
                      }`}
                    />
                  </div>
                );
              })}
            </Fragment>
          ))
        )}
      </div>
      {othersCount > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Shaded background shows when others are available.
        </p>
      )}
    </div>
  );
}

