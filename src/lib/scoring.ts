/** Great is the baseline (1). If needed uses a dampening multiplier in [0, 1], default 0.75. */
export const DEFAULT_IF_NEEDED_WEIGHT = 0.75;

export function getSlotScoreValue(
  greatCount: number,
  ifNeededCount: number,
  ifNeededWeight: number = DEFAULT_IF_NEEDED_WEIGHT
): number {
  return greatCount * 1 + ifNeededCount * ifNeededWeight;
}

