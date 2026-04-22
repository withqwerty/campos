export function normalizeWyscoutClock(
  matchPeriod: string,
  eventSec: number,
): {
  minute: number;
  addedMinute: null;
  second: number;
} {
  const wholeSeconds = Math.max(0, Math.floor(eventSec));

  return {
    minute: periodMinuteOffset(matchPeriod) + Math.floor(wholeSeconds / 60),
    addedMinute: null,
    second: wholeSeconds % 60,
  };
}

function periodMinuteOffset(matchPeriod: string): number {
  switch (matchPeriod) {
    case "1H":
      return 0;
    case "2H":
      return 45;
    case "E1":
      return 90;
    case "E2":
      return 105;
    case "P":
      return 120;
    default:
      throw new Error(`Unsupported Wyscout matchPeriod time offset: ${matchPeriod}`);
  }
}
