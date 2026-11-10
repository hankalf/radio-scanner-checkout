// Due-date rule: every device is due back at the end of the shift it was
// checked out on. Shift end times are a Setting ("shiftEnds", e.g.
// "07:00,15:00,23:00") so the warehouse can match its own schedule.
//
// Uses the server's local time zone — set the container/host TZ
// (e.g. TZ=America/New_York) to match the warehouse.

export const DEFAULT_SHIFT_ENDS = "07:00,15:00,23:00";

// A device checked out this close to a shift end (e.g. by the incoming
// shift arriving early) is due at the FOLLOWING shift end instead.
export const EARLY_CHECKOUT_GRACE_MIN = 60;

// Parse "07:00, 15:00,23:00" into sorted minutes-after-midnight. Invalid
// entries are dropped; an empty result means "end of day".
export function parseShiftEnds(value: string | null | undefined): number[] {
  const mins = (value ?? "")
    .split(/[,\s]+/)
    .map((s) => /^(\d{1,2}):(\d{2})$/.exec(s.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => Number(m[1]) * 60 + Number(m[2]))
    .filter((m) => m >= 0 && m < 24 * 60);
  return [...new Set(mins)].sort((a, b) => a - b);
}

export function formatShiftEnds(mins: number[]): string {
  return mins
    .map((m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)
    .join(", ");
}

export function computeDueDate(shiftEnds: number[], now: Date): Date {
  if (shiftEnds.length === 0) {
    const e = new Date(now);
    e.setHours(23, 59, 59, 999);
    return e;
  }
  const earliest = now.getTime() + EARLY_CHECKOUT_GRACE_MIN * 60_000;
  // Look at today's and tomorrow's shift ends; the first one past the grace
  // window is the due time.
  for (let day = 0; day <= 1; day++) {
    for (const m of shiftEnds) {
      const d = new Date(now);
      d.setDate(now.getDate() + day);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (d.getTime() >= earliest) return d;
    }
  }
  // Unreachable with at least one shift end, but keep a sane fallback.
  const d = new Date(now);
  d.setDate(now.getDate() + 2);
  d.setHours(Math.floor(shiftEnds[0] / 60), shiftEnds[0] % 60, 0, 0);
  return d;
}
