import { test, expect } from "@playwright/test";
import { PIN, prisma, resetDevice, kioskStart, statusOf } from "./helpers";
import { computeDueDate, parseShiftEnds, DEFAULT_SHIFT_ENDS } from "../src/lib/schedule";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Pure due-time rule: next shift end, skipping one that's within the grace hour.
test("due time is the next shift end", () => {
  const ends = parseShiftEnds("07:00, 15:00,23:00");
  const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m);
  expect(computeDueDate(ends, at(9)).getHours()).toBe(15);
  expect(computeDueDate(ends, at(16)).getHours()).toBe(23);
  // 14:30 is within an hour of 15:00, so the incoming shift gets 23:00.
  expect(computeDueDate(ends, at(14, 30)).getHours()).toBe(23);
  // Late night wraps to tomorrow's 07:00.
  const overnight = computeDueDate(ends, at(23, 30));
  expect(overnight.getDate()).toBe(11);
  expect(overnight.getHours()).toBe(7);
});

test("kiosk checkout stamps the next shift end", async ({ page }) => {
  const N = "R018";
  await resetDevice(N);
  const before = new Date();
  await kioskStart(page, N, PIN.operator, /Yes, that's me/);
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  const setting = await prisma.setting.findUnique({ where: { key: "shiftEnds" } });
  const expected = computeDueDate(parseShiftEnds(setting?.value ?? DEFAULT_SHIFT_ENDS), before);
  const device = await prisma.device.findFirst({ where: { number: N } });
  expect(device!.dueAt!.getTime()).toBe(expected.getTime());

  await resetDevice(N);
});
