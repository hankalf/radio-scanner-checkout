import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("kiosk is open and bilingual", async ({ page }) => {
  await page.goto("/kiosk");
  await expect(
    page.getByRole("heading", { name: "Safety Knife Check-in / Checkout" })
  ).toBeVisible();
  // Spanish instructions are present underneath the English ones.
  await expect(page.getByText(/Toque un cuchillo/)).toBeVisible();
});

test("the fleet board is gated to admins/QA", async ({ page }) => {
  await page.goto("/");
  // Signed out → sign-in overlay.
  await expect(page.getByText(/Admins .* enter your PIN/i)).toBeVisible();

  // An operator PIN is accepted but denied the management board.
  await enterPin(page, PIN.operator);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText(/for admins .* QA/i)).toBeVisible();
});

test("an admin PIN opens the fleet board", async ({ page }) => {
  await page.goto("/");
  await enterPin(page, PIN.admin);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "Knife fleet" })).toBeVisible();
});
