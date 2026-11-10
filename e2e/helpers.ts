import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";

// A single Prisma client shared across the e2e run. Tests use it to reset a
// device to a known state and to assert on the persisted result.
export const prisma = new PrismaClient();

// Default seeded PINs (see prisma/seed.ts).
export const PIN = {
  admin: "0000",
  operator: "1111",
  supervisor: "2222",
} as const;

export async function enterPin(page: Page, pin: string) {
  for (const d of pin.split("")) {
    await page.getByRole("button", { name: d, exact: true }).first().click();
  }
}

// Put a device back to a clean AVAILABLE state so a test starts predictably.
export async function resetDevice(number: string) {
  await prisma.device.updateMany({
    where: { number },
    data: {
      status: "AVAILABLE",
      checkedOutById: null,
      checkedOutAt: null,
      dueAt: null,
      damageNote: null,
      damagePhoto: null,
      retiredAt: null,
    },
  });
}

export async function statusOf(number: string) {
  return (await prisma.device.findFirst({ where: { number } }))?.status;
}

export const kioskTile = (page: Page, number: string) =>
  page.locator(`button[title^="${number} —"]`).first();

export const boardTile = (page: Page, number: string) =>
  page.locator(`button[title*=" ${number} —"]`).first();

// Kiosk: tap a tile, enter a PIN, and confirm the name.
export async function kioskStart(page: Page, number: string, pin: string, confirm: RegExp) {
  await page.goto("/kiosk");
  await kioskTile(page, number).click();
  await enterPin(page, pin);
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("button", { name: confirm }).click();
}
