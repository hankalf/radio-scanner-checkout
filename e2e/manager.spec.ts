import { test, expect } from "@playwright/test";
import { enterPin, PIN, prisma, resetKnife, boardTile } from "./helpers";

// A manager account is created on demand so this spec is self-contained.
const MANAGER_PIN = "4444";

test.beforeAll(async () => {
  const { hashPin } = await import("../src/lib/crypto");
  const existing = await prisma.worker.findFirst({ where: { name: "Morgan (Manager)" } });
  if (!existing) {
    await prisma.worker.create({
      data: { name: "Morgan (Manager)", pin: hashPin(MANAGER_PIN), roles: "MANAGER", active: true },
    });
  }
});

test.afterAll(async () => {
  await prisma.worker.deleteMany({ where: { name: "Morgan (Manager)" } });
  await prisma.$disconnect();
});

async function signIn(page: import("@playwright/test").Page, pin: string) {
  await page.goto("/");
  await enterPin(page, pin);
  await page.getByRole("button", { name: "Enter" }).click();
}

test("a manager gets a read-only admin panel with the fleet and the log", async ({ page }) => {
  await signIn(page, MANAGER_PIN);
  await expect(page.getByRole("heading", { name: "Knife fleet" })).toBeVisible();

  await page.goto("/admin");
  // Visible: the fleet list and the audit log.
  await expect(page.getByRole("heading", { name: /Knife fleet \(/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Recent activity/ })).toBeVisible();
  await expect(page.getByText(/view-only/)).toBeVisible();
  // Hidden: everything that changes configuration.
  await expect(page.getByRole("heading", { name: "Add a knife" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Workers" })).toHaveCount(0);
  await expect(page.getByText("Advanced", { exact: true })).toHaveCount(0);
  // And no per-knife editing.
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
});

test("a manager can run floor actions and clear a damaged knife", async ({ page }) => {
  const N = "8";
  await resetKnife(N);
  await signIn(page, MANAGER_PIN);

  // Operator capability.
  await boardTile(page, N).click();
  await page.getByRole("button", { name: /^Check out$/ }).click();
  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("CHECKED_OUT");

  // Configuration is off-limits even though managers hold QA lifecycle powers.
  await boardTile(page, N).click();
  await expect(page.getByText("Knife type")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Damaged knives are the manager's call.
  await prisma.knife.updateMany({
    where: { number: N },
    data: { status: "DAMAGED", damageNote: "Chipped tip", checkedOutById: null, dueAt: null },
  });
  await page.reload();
  await boardTile(page, N).click();
  await page.getByRole("button", { name: /Return to service \(manager\)/ }).click();
  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("AVAILABLE");

  await resetKnife(N);
});

test("QA manages knives but not employees or Teams, and can clear damage", async ({ page }) => {
  const N = "7";
  await resetKnife(N);
  await prisma.knife.updateMany({
    where: { number: N },
    data: { status: "DAMAGED", damageNote: "Chipped tip" },
  });

  await signIn(page, PIN.qa);

  // QA now reviews damaged knives.
  await boardTile(page, N).click();
  await page.getByRole("button", { name: /Return to service/ }).click();
  await expect
    .poll(async () => (await prisma.knife.findFirst({ where: { number: N } }))?.status)
    .toBe("AVAILABLE");

  await page.goto("/admin");
  // Knives stay editable for QA…
  await expect(page.getByRole("heading", { name: "Knives" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
  // …but employees and Teams settings are admin-only.
  await expect(page.getByRole("heading", { name: "Workers" })).toHaveCount(0);
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByText("Microsoft Teams notifications")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kiosk logo" })).toBeVisible();

  await resetKnife(N);
});
