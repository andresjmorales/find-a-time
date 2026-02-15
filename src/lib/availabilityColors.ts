/**
 * Central place for availability grid and paint selector colors.
 * Edit these to change Great / If needed / Unavailable appearance app-wide.
 */

/** Unavailable (red/pink) — used for paint chip and grid cells. Change this hex to update both. */
export const UNAVAILABLE_HEX = "#ffbfc0";

/** Opacity for unavailable grid cells (0–1). */
export const UNAVAILABLE_GRID_OPACITY = 0.7;

/** How much to blend toward deeper red/pink for unselected chip text (0–1). 0.25 = 25% more vibrant. */
export const UNAVAILABLE_TEXT_VIBRANCY = 0.25;

/** Deeper pink/red to blend toward for unselected chip text (more saturated). */
export const UNAVAILABLE_DEEPER_HEX = "#d81b60";

/** Unselected chip text color — blended toward deeper pink/red for visibility on gray. */
export function getUnavailableTextUnselectedHex(): string {
  const parse = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  });
  const a = parse(UNAVAILABLE_HEX);
  const b = parse(UNAVAILABLE_DEEPER_HEX);
  const t = UNAVAILABLE_TEXT_VIBRANCY;
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/** For use in style={{ backgroundColor: ... }} on unavailable grid cells. */
export function getUnavailableGridBg(): string {
  const hex = UNAVAILABLE_HEX.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${UNAVAILABLE_GRID_OPACITY})`;
}

export const availabilityColors = {
  great: {
    /** Paint chip when selected; input grid cell */
    bg: "bg-emerald-500",
    /** Paint chip when unselected (text on gray) */
    textUnselected: "text-emerald-600",
    /** View mode single-participant cell fill (RGB for canvas/style) */
    rgb: "rgb(22, 163, 74)",
  },
  ifNeeded: {
    bg: "bg-amber-400",
    textUnselected: "text-amber-600",
    rgb: "rgb(250, 204, 21)",
  },
  unavailable: {
    /** Paint chip when unselected */
    textUnselected: "text-pink-600",
  },
} as const;
