"use client";

import { useState, useCallback, useRef } from "react";

interface AvailabilityGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  selectedSlots: string[];
  onSlotsChange: (slots: string[]) => void;
  mode: "input";
}

interface GroupAvailabilityGridProps {
  dates: string[];
  startHour: number;
  endHour: number;
  availability: { participantName: string; slots: string[] }[];
  mode: "view";
}

type Props = AvailabilityGridProps | GroupAvailabilityGridProps;

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
  const [dragMode, setDragMode] = useState<"add" | "remove">("add");
  const dragStarted = useRef(false);

  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(h);
  }

  const handleMouseDown = useCallback(
    (slot: string) => {
      if (mode !== "input") return;
      const p = props as AvailabilityGridProps;
      setIsDragging(true);
      dragStarted.current = true;
      const isSelected = p.selectedSlots.includes(slot);
      setDragMode(isSelected ? "remove" : "add");
      if (isSelected) {
        p.onSlotsChange(p.selectedSlots.filter((s) => s !== slot));
      } else {
        p.onSlotsChange([...p.selectedSlots, slot]);
      }
    },
    [mode, props]
  );

  const handleMouseEnter = useCallback(
    (slot: string) => {
      if (mode !== "input" || !isDragging) return;
      const p = props as AvailabilityGridProps;
      if (dragMode === "add" && !p.selectedSlots.includes(slot)) {
        p.onSlotsChange([...p.selectedSlots, slot]);
      } else if (dragMode === "remove" && p.selectedSlots.includes(slot)) {
        p.onSlotsChange(p.selectedSlots.filter((s) => s !== slot));
      }
    },
    [mode, isDragging, dragMode, props]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStarted.current = false;
  }, []);

  if (mode === "view") {
    const p = props as GroupAvailabilityGridProps;
    const totalParticipants = p.availability.length;

    function getSlotCount(slot: string): number {
      return p.availability.filter((a) => a.slots.includes(slot)).length;
    }

    function getSlotParticipants(slot: string): string[] {
      return p.availability
        .filter((a) => a.slots.includes(slot))
        .map((a) => a.participantName);
    }

    function getHeatColor(count: number): string {
      if (totalParticipants === 0 || count === 0) return "bg-gray-50";
      const ratio = count / totalParticipants;
      if (ratio <= 0.25) return "bg-emerald-100";
      if (ratio <= 0.5) return "bg-emerald-300";
      if (ratio <= 0.75) return "bg-emerald-400";
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
          {/* Header row */}
          <div />
          {dates.map((date) => (
            <div
              key={date}
              className="text-center text-xs font-medium text-gray-600 pb-2 px-1"
            >
              {formatDateHeader(date)}
            </div>
          ))}

          {/* Time slots */}
          {hours.map((hour) =>
            [0, 1].map((half) => (
              <Fragment key={`row-${hour}-${half}`}>
                <div className="text-right pr-3 text-xs text-gray-500 flex items-center justify-end h-6">
                  {half === 0 ? formatHour(hour) : ""}
                </div>
                {dates.map((date) => {
                  const slot = slotKey(date, hour, half);
                  const count = getSlotCount(slot);
                  const participants = getSlotParticipants(slot);
                  return (
                    <div
                      key={slot}
                      className={`h-6 border border-gray-200 ${getHeatColor(count)} transition-colors cursor-default group relative`}
                      title={
                        count > 0
                          ? `${count}/${totalParticipants}: ${participants.join(", ")}`
                          : "No one available"
                      }
                    >
                      {count > 0 && (
                        <div className="hidden group-hover:block absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
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

        {/* Legend */}
        {totalParticipants > 0 && (
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
            <span>Fewer</span>
            <div className="w-6 h-4 bg-emerald-100 border border-gray-200" />
            <div className="w-6 h-4 bg-emerald-300 border border-gray-200" />
            <div className="w-6 h-4 bg-emerald-400 border border-gray-200" />
            <div className="w-6 h-4 bg-emerald-500 border border-gray-200" />
            <span>More available</span>
          </div>
        )}
      </div>
    );
  }

  // Input mode
  const p = props as AvailabilityGridProps;

  return (
    <div
      className="overflow-x-auto select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="inline-grid gap-0"
        style={{
          gridTemplateColumns: `80px repeat(${dates.length}, minmax(100px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div />
        {dates.map((date) => (
          <div
            key={date}
            className="text-center text-xs font-medium text-gray-600 pb-2 px-1"
          >
            {formatDateHeader(date)}
          </div>
        ))}

        {/* Time slots */}
        {hours.map((hour) =>
          [0, 1].map((half) => (
            <Fragment key={`row-${hour}-${half}`}>
              <div className="text-right pr-3 text-xs text-gray-500 flex items-center justify-end h-7">
                {half === 0 ? formatHour(hour) : ""}
              </div>
              {dates.map((date) => {
                const slot = slotKey(date, hour, half);
                const isSelected = p.selectedSlots.includes(slot);
                return (
                  <div
                    key={slot}
                    className={`h-7 border border-gray-200 cursor-pointer transition-colors
                      ${isSelected ? "bg-emerald-400" : "bg-white hover:bg-emerald-50"}
                    `}
                    onMouseDown={() => handleMouseDown(slot)}
                    onMouseEnter={() => handleMouseEnter(slot)}
                  />
                );
              })}
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}

// Need Fragment import
import { Fragment } from "react";
