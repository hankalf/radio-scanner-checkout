import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma, resetKnife, kioskTile } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Type-based due dates: FC knives come back the same day (end of shift);
// NFC knives are out for the week and due Friday end of day.
test("FC checkout is due end of today; NFC end of Friday", async ({ page }) => {
  const FC = "11";
  const NFC = "12";
  await resetKnife(FC, "FC");
  await resetKnife(NFC, "NFC");

  for (const n of [FC, NFC]) {
    await page.goto("/kiosk");
    await kioskTile(page, n).click();
    await enterPin(page, PIN.operator);
    await page.getByRole("button", { name: /Siguiente/ }).click();
    await page.getByRole("button", { name: /Yes, that's me/ }).click();
    await expect
      .poll(async () => (await prisma.knife.findFirst({ where: { number: n } }))?.status)
      .toBe("CHECKED_OUT");
  }

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const friday = new Date(now);
  friday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7));
  friday.setHours(23, 59, 59, 999);

  const fc = await prisma.knife.findFirst({ where: { number: FC } });
  const nfc = await prisma.knife.findFirst({ where: { number: NFC } });
  expect(Math.abs(fc!.dueAt!.getTime() - endOfToday.getTime())).toBeLessThan(5000);
  expect(Math.abs(nfc!.dueAt!.getTime() - friday.getTime())).toBeLessThan(5000);

  await resetKnife(FC, "FC");
  await resetKnife(NFC, "FC");
});
