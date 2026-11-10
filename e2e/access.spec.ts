import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("kiosk is open, bilingual, and shows all 40 devices", async ({ page }) => {
  await page.goto("/kiosk");
  await expect(
    page.getByRole("heading", { name: "Radio & Scanner Check-in / Checkout" })
  ).toBeVisible();
  // Spanish instructions are present underneath the English ones.
  await expect(page.getByText(/Toque un radio o escáner/)).toBeVisible();
  await expect(page.locator('button[title^="R001 —"]')).toBeVisible();
  await expect(page.locator('button[title^="S020 —"]')).toBeVisible();
});

test("the fleet board is gated to supervisors/admins", async ({ page }) => {
  await page.goto("/");
  // Signed out → sign-in overlay.
  await expect(page.getByText(/Supervisors .* enter your PIN/i)).toBeVisible();

  // An operator PIN is accepted but denied the management board.
  await enterPin(page, PIN.operator);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText(/for supervisors .* admins/i)).toBeVisible();
});

test("an admin PIN opens the fleet board", async ({ page }) => {
  await page.goto("/");
  await enterPin(page, PIN.admin);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "Radios & scanners" })).toBeVisible();
});
