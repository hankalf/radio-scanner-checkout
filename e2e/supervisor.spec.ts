import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma, resetDevice, boardTile, statusOf } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: import("@playwright/test").Page, pin: string) {
  await page.goto("/");
  await enterPin(page, pin);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("heading", { name: "Radios & scanners" })).toBeVisible();
}

test("a supervisor manages devices but not employees or Teams", async ({ page }) => {
  await signIn(page, PIN.supervisor);
  await expect(page.getByRole("heading", { name: "Radios & scanners" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Radios & scanners" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a device" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Recent activity/ })).toBeVisible();
  // Employees and Teams settings are admin-only.
  await expect(page.getByRole("heading", { name: "Workers" })).toHaveCount(0);
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByText("Microsoft Teams notifications")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Shift end times" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kiosk logo" })).toBeVisible();
});

test("a supervisor can check out, return, and retire from the board", async ({ page }) => {
  const N = "S018";
  await resetDevice(N);
  await signIn(page, PIN.supervisor);

  await boardTile(page, N).click();
  await page.getByRole("button", { name: /^Check out$/ }).click();
  await expect.poll(() => statusOf(N)).toBe("CHECKED_OUT");

  await boardTile(page, N).click();
  await page.getByRole("button", { name: /Check in \(return\)/ }).click();
  await page.getByRole("button", { name: "Yes / Sí" }).click();
  await page.getByRole("button", { name: "Good / Bueno" }).click();
  await page.getByRole("button", { name: /Submit/ }).click();
  await expect.poll(() => statusOf(N)).toBe("AVAILABLE");

  await boardTile(page, N).click();
  await page.getByRole("button", { name: /Retire/ }).click();
  await expect.poll(() => statusOf(N)).toBe("OUT_OF_SERVICE");

  await resetDevice(N);
});

async function removeS99() {
  await prisma.deviceEvent.deleteMany({ where: { device: { number: "S099" } } });
  await prisma.device.deleteMany({ where: { number: "S099" } });
}

test("an admin can add a scanner with a bare number", async ({ page }) => {
  await removeS99();
  await signIn(page, PIN.admin);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Scanner", exact: true }).first().click();
  await page.getByPlaceholder(/Label \(e\.g\. S021\)/).fill("99");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect
    .poll(async () => (await prisma.device.findFirst({ where: { number: "S099" } }))?.type)
    .toBe("SCANNER");
  await removeS99();
});
