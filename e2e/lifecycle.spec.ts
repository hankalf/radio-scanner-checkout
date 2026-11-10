import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma, resetKnife, kioskTile, boardTile } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// One operator round-trip plus sanitation on the kiosk: AVAILABLE → CHECKED_OUT
// → DIRTY → AVAILABLE, with the "Good" checklist path.
test("kiosk lifecycle: checkout, holder shown, check in, clean good", async ({ page }) => {
  const N = "14";
  await resetKnife(N);

  // Check out as an operator.
  await page.goto("/kiosk");
  await kioskTile(page, N).click();
  await enterPin(page, PIN.operator);
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("button", { name: /Yes, that's me/ }).click();

  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("CHECKED_OUT");

  // The holder's name shows on the bubble.
  await page.goto("/kiosk");
  await expect(kioskTile(page, N)).toContainText(/\w/);
  await expect(page.getByText("Olivia", { exact: false }).first()).toBeVisible();

  // Check it back in (→ DIRTY).
  await kioskTile(page, N).click();
  await enterPin(page, PIN.operator);
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("button", { name: /Yes, that's me/ }).click();
  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("DIRTY");

  // Sanitation: cleaned + inspected + good → back to AVAILABLE.
  await page.goto("/kiosk");
  await kioskTile(page, N).click();
  await enterPin(page, PIN.sanitation);
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("button", { name: /Yes — continue/ }).click();
  await page.getByRole("button", { name: "Yes / Sí" }).first().click();
  await page.getByRole("button", { name: "Yes / Sí" }).nth(1).click();
  await page.getByRole("button", { name: "Good / Bueno" }).click();
  await page.getByRole("button", { name: /Submit/ }).click();

  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("AVAILABLE");
});

// The damaged path: sanitation flags damage, the knife is held, and only a
// manager can return it to service.
test("damaged knife requires a manager to return", async ({ page }) => {
  const N = "13";
  await resetKnife(N);

  // Drive to DIRTY (checkout then check in).
  for (let i = 0; i < 2; i++) {
    await page.goto("/kiosk");
    await kioskTile(page, N).click();
    await enterPin(page, PIN.operator);
    await page.getByRole("button", { name: /Siguiente/ }).click();
    await page.getByRole("button", { name: /Yes, that's me/ }).click();
    await page.waitForTimeout(300);
  }

  // Sanitation flags it damaged with a reason.
  await page.goto("/kiosk");
  await kioskTile(page, N).click();
  await enterPin(page, PIN.sanitation);
  await page.getByRole("button", { name: /Siguiente/ }).click();
  await page.getByRole("button", { name: /Yes — continue/ }).click();
  await page.getByRole("button", { name: "Yes / Sí" }).first().click();
  await page.getByRole("button", { name: "Yes / Sí" }).nth(1).click();
  await page.getByRole("button", { name: /Damaged/ }).click();
  await page.getByPlaceholder(/Describe the damage/).fill("Chipped edge");
  await page.getByRole("button", { name: /Submit/ }).click();

  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("DAMAGED");

  // A manager (admin) returns it to service from the board.
  await page.goto("/");
  await enterPin(page, PIN.admin);
  await page.getByRole("button", { name: "Enter" }).click();
  await boardTile(page, N).click();
  await expect(page.getByText(/Reported damage/)).toBeVisible();
  await page.getByRole("button", { name: /Return to service \(manager\)/ }).click();

  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("AVAILABLE");
});
