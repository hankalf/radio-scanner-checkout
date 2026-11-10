// Due-date rules by knife type. Uses the server's local time zone — set the
// container/host TZ (e.g. TZ=America/Chicago) to match the plant.
//
//   FC  (Food Contact)      → due end of the SAME day (checked out & back by end of shift)
//   NFC (Non-Food Contact)  → due end of FRIDAY of the checkout week (out M–F, back Friday)

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

export function computeDueDate(type: string, now: Date): Date {
  if (type === "NFC") {
    // Days until Friday (getDay: Sun=0 … Fri=5 … Sat=6). If already Friday, today.
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    return endOfDay(friday);
  }
  // FC (default): end of today.
  return endOfDay(now);
}
