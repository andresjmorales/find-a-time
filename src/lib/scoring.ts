export const GREAT_WEIGHT = 3;
export const IF_NEEDED_WEIGHT = 2;

export function getSlotScoreValue(greatCount: number, ifNeededCount: number): number {
  return greatCount * GREAT_WEIGHT + ifNeededCount * IF_NEEDED_WEIGHT;
}

