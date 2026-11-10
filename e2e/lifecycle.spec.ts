import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma, resetDevice, kioskTile, boardTile, kioskStart, statusOf } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// One operator round-trip on the kiosk: AVAILABLE → CHECKED_OUT → AVAILABLE,
// with the "on charger + Good" return checklist.
test("kiosk lifecycle: checkout, holder shown, return good", async ({ page }) => {
  const N = "R020";
  await resetDevice(N);

  await kioskStart(page, N, PIN.operator, /Yes, that's me/);
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  // The holder's name shows on the tile.
  await page.goto("/kiosk");
  await expect(kioskTile(page, N)).toContainText("Olivia");

  // Check it back in with the checklist.
  await kioskStart(page, N, PIN.operator, /Yes — continue/);
  await page.getByRole("button", { name: "Yes / Sí" }).click();
  await page.getByRole("button", { name: "Good / Bueno" }).click();
  await page.getByRole("button", { name: /Submit/ }).click();

  await expect.poll(() => statusOf(N)).toBe("AVAILABLE");
});

// The checklist won't submit until the device is on its charger.
test("return requires the device on the charger", async ({ page }) => {
  const N = "S020";
  await resetDevice(N);
  await kioskStart(page, N, PIN.operator, /Yes, that's me/);
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  await kioskStart(page, N, PIN.operator, /Yes — continue/);
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Good / Bueno" }).click();
  await expect(page.getByText(/Put it on the charger first/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Submit/ })).toBeDisabled();

  await resetDevice(N);
});

// Someone else's device can't be returned by another operator.
test("only the holder (or a supervisor) can return a device", async ({ page }) => {
  const N = "R019";
  await resetDevice(N);
  const { hashPin } = await import("../src/lib/crypto");
  await prisma.worker.deleteMany({ where: { name: "Other Operator" } });
  const other = await prisma.worker.create({
    data: { name: "Other Operator", pin: hashPin("5151"), roles: "OPERATOR" },
  });

  await kioskStart(page, N, PIN.operator, /Yes, that's me/);
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  await page.goto("/kiosk");
  await kioskTile(page, N).click();
  await enterPin(page, "5151");
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await expect(page.getByText(/checked out by someone else/)).toBeVisible();

  await resetDevice(N);
  await prisma.worker.delete({ where: { id: other.id } });
});

// The damaged path: an operator returns it damaged, the device is held, and
// a supervisor returns it to service from the board.
test("damaged device requires a supervisor to return", async ({ page }) => {
  const N = "S019";
  await resetDevice(N);

  await kioskStart(page, N, PIN.operator, /Yes, that's me/);
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  await kioskStart(page, N, PIN.operator, /Yes — continue/);
  await page.getByRole("button", { name: "Yes / Sí" }).click();
  await page.getByRole("button", { name: /Damaged/ }).click();
  await page.getByPlaceholder(/Describe the damage/).fill("Cracked screen");
  await page.getByRole("button", { name: /Submit/ }).click();

  await expect.poll(() => statusOf(N)).toBe("DAMAGED");

  await page.goto("/");
  await enterPin(page, PIN.supervisor);
  await page.getByRole("button", { name: "Enter" }).click();
  await boardTile(page, N).click();
  await expect(page.getByText(/Reported damage/)).toBeVisible();
  await page.getByRole("button", { name: /Return to service \(supervisor\)/ }).click();

  await expect.poll(() => statusOf(N)).toBe("AVAILABLE");
});
