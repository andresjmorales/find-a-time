"use client";

import { Fragment, useState, useCallback, useRef } from "react";

export type SlotMark = "great" | "prefer" | "unavailable";

interface AvailabilityGridInputProps {
  dates: string[];
  startHour: number;
  endHour: number;
  slotsGreat: string[];
  slotsPrefer: string[];
  onSlotsChange: (opts: { great: string[]; prefer: string[] }) => void;
  mode: "input";
  /** Other participants' availability to show as overlay underneath */
  othersAvailability?: { slots: string[]; slotsPrefer?: string[] }[];
}

interface GroupAvailabilityGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  availability: {
    participantName: string;
    slots: string[];
    slotsPrefer?: string[];
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

    function getSlotScore(slot: string): { great: number; prefer: number } {
      let great = 0;
      let prefer = 0;
      for (const a of p.availability) {
        if (a.slots.includes(slot)) great++;
        else if (a.slotsPrefer?.includes(slot)) prefer++;
      }
      return { great, prefer };
    }

    function getSlotParticipants(slot: string): string[] {
      return p.availability
        .filter(
          (a) => a.slots.includes(slot) || a.slotsPrefer?.includes(slot)
        )
        .map((a) => a.participantName);
    }

    function getHeatColor(great: number, prefer: number): string {
      if (totalParticipants === 0 && great === 0 && prefer === 0)
        return "bg-slate-50";
      const total = great * 2 + prefer; // great counts more
      const maxTotal = totalParticipants * 2;
      const ratio = maxTotal === 0 ? 0 : total / maxTotal;
      if (ratio === 0) return "bg-slate-100";
      if (ratio <= 0.25) return "bg-amber-100";
      if (ratio <= 0.5) return "bg-lime-200";
      if (ratio <= 0.75) return "bg-emerald-300";
      return "bg-emerald-500";
    }

    return (
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-0"
          style={{
            gridTemplateColumns: `80px repeat(${dates.length}, minmax(100px, 1fr))`,
          }}
        >
          <div />
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
                <div className="text-right pr-3 text-xs text-slate-500 flex items-center justify-end h-6">
                  {half === 0 ? formatHour(hour) : ""}
                </div>
                {dates.map((date) => {
                  const slot = slotKey(date, hour, half);
                  const { great, prefer } = getSlotScore(slot);
                  const participants = getSlotParticipants(slot);
                  return (
                    <div
                      key={slot}
                      className={`h-6 border border-slate-200 ${getHeatColor(great, prefer)} transition-colors cursor-default group relative`}
                      title={
                        participants.length > 0
                          ? `${great} great, ${prefer} if needed: ${participants.join(", ")}`
                          : "No one available"
                      }
                    >
                      {participants.length > 0 && (
                        <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap">
                          {participants.join(", ")}
                        </div>
                      )}
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
              <span className="w-4 h-3 bg-slate-100 border border-slate-200 rounded" />
              none
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-3 bg-amber-100 border border-slate-200 rounded" />
              if needed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-3 bg-emerald-400 border border-slate-200 rounded" />
              great
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
        if (o.slots.includes(slot) || o.slotsPrefer?.includes(slot)) n++;
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
      const inPrefer = p.slotsPrefer.includes(slot);

      if (paintAs === "unavailable") {
        p.onSlotsChange({
          great: p.slotsGreat.filter((s) => s !== slot),
          prefer: p.slotsPrefer.filter((s) => s !== slot),
        });
        return;
      }
      if (paintAs === "great") {
        p.onSlotsChange({
          great: inGreat
            ? p.slotsGreat.filter((s) => s !== slot)
            : [...p.slotsGreat.filter((s) => s !== slot), slot],
          prefer: p.slotsPrefer.filter((s) => s !== slot),
        });
        return;
      }
      // prefer
      p.onSlotsChange({
        great: p.slotsGreat.filter((s) => s !== slot),
        prefer: inPrefer
          ? p.slotsPrefer.filter((s) => s !== slot)
          : [...p.slotsPrefer.filter((s) => s !== slot), slot],
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
          prefer: p.slotsPrefer.filter((s) => s !== slot),
        });
        return;
      }
      if (mark === "great") {
        if (!p.slotsGreat.includes(slot)) {
          p.onSlotsChange({
            great: [...p.slotsGreat, slot],
            prefer: p.slotsPrefer.filter((s) => s !== slot),
          });
        }
        return;
      }
      if (!p.slotsPrefer.includes(slot)) {
        p.onSlotsChange({
          great: p.slotsGreat.filter((s) => s !== slot),
          prefer: [...p.slotsPrefer, slot],
        });
      }
    },
    [isDragging, p]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const inGreat = (slot: string) => p.slotsGreat.includes(slot);
  const inPrefer = (slot: string) => p.slotsPrefer.includes(slot);
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
            { value: "prefer" as const, label: "If needed", bg: "bg-amber-400" },
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
      </div>

      <div
        className="inline-grid gap-0 relative"
        style={{
          gridTemplateColumns: `80px repeat(${dates.length}, minmax(100px, 1fr))`,
        }}
      >
        <div />
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
              <div className="text-right pr-3 text-xs text-slate-500 flex items-center justify-end h-8">
                {half === 0 ? formatHour(hour) : ""}
              </div>
              {dates.map((date) => {
                const slot = slotKey(date, hour, half);
                const great = inGreat(slot);
                const prefer = inPrefer(slot);
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
                          : prefer
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
