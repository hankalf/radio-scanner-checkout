import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";

// A single Prisma client shared across the e2e run. Tests use it to reset a
// knife to a known state and to assert on the persisted result.
export const prisma = new PrismaClient();

// Default seeded PINs (see prisma/seed.ts).
export const PIN = {
  admin: "0000",
  operator: "1111",
  sanitation: "2222",
  qa: "3333",
} as const;

export async function enterPin(page: Page, pin: string) {
  for (const d of pin.split("")) {
    await page.getByRole("button", { name: d, exact: true }).first().click();
  }
}

// Put a knife back to a clean AVAILABLE/FC state so a test starts predictably.
export async function resetKnife(number: string, type: "FC" | "NFC" = "FC") {
  await prisma.knife.updateMany({
    where: { number },
    data: {
      status: "AVAILABLE",
      type,
      checkedOutById: null,
      checkedOutAt: null,
      dueAt: null,
      damageNote: null,
      damagePhoto: null,
    },
  });
}

export const kioskTile = (page: Page, number: string) =>
  page.locator(`button[title^="#${number} —"]`).first();

export const boardTile = (page: Page, number: string) =>
  page.locator(`button[title^="Knife #${number} —"]`).first();
