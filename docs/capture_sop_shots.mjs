/**
 * Capture the screenshots used by the SOP PDF.
 *
 *   node docs/capture_sop_shots.mjs        (app must be running on PW_BASE_URL)
 *
 * Sets up representative fleet state, captures each screen to docs/img/,
 * then restores the fleet and worker names.
 */
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.PW_BASE_URL || "http://localhost:3000";
const EXE = process.env.PW_EXECUTABLE_PATH || undefined;
const IMG = resolve(dirname(fileURLToPath(import.meta.url)), "img");
mkdirSync(IMG, { recursive: true });

const TZID = process.env.SHOT_TZ || "America/New_York";
const prisma = new PrismaClient();
const shot = (p, name, opts = {}) => p.screenshot({ path: `${IMG}/${name}.png`, ...opts });
const enterPin = async (p, pin) => {
  for (const d of pin.split("")) await p.getByRole("button", { name: d, exact: true }).first().click();
};
// A small JPEG stand-in for a damage photo taken on the tablet.
const DAMAGE_PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADIAUADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDyqiiitiAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKK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BRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACMoZSrAFSMEHoazp9Gs5ckI0ZJySjf0PFaVFRKEZ/EjajiKtB3pya9DJj0G0VwWMrgfwswwfyFaFtbQ2ybYI1QHrjqfqe9TUUo0oQ+FFVsZXrq1SbaCvO/jl/wAinaf9fyf+i5K9Erzv45f8inaf9fyf+i5K0Oc8OooopgFFFFAFHUv+Wf4/0qlWyyK+NyhseozTfJj/AOeaf98igDIorX8mP/nmn/fIo8mP/nmn/fIoAyKK1/Jj/wCeaf8AfIo8mP8A55p/3yKAMiitfyY/+eaf98ijyY/+eaf98igD6f8ABP8AyJmgf9g+3/8ARa1tV8uweINZt4Y4YNX1GKGNQiIly6qqgYAAB4Ap/wDwk2vf9BvU/wDwLk/xpWA+n6K+YP8AhJte/wCg3qf/AIFyf40f8JNr3/Qb1P8A8C5P8aLAfT9FfMH/AAk2vf8AQb1P/wAC5P8AGj/hJte/6Dep/wDgXJ/jRYD6for5g/4SbXv+g3qf/gXJ/jR/wk2vf9BvU/8AwLk/xosB9P0V8wf8JNr3/Qb1P/wLk/xo/wCEm17/AKDep/8AgXJ/jRYD6for5g/4SbXv+g3qf/gXJ/jR/wAJNr3/AEG9T/8AAuT/ABosB9P0V8wf8JNr3/Qb1P8A8C5P8aP+Em17/oN6n/4Fyf40WA+n6K+YP+Em17/oN6n/AOBcn+NH/CTa9/0G9T/8C5P8aLAfT9FfMH/CTa9/0G9T/wDAuT/Gj/hJte/6Dep/+Bcn+NFgPp+ivmD/AISbXv8AoN6n/wCBcn+NH/CTa9/0G9T/APAuT/GiwH0/RXzB/wAJNr3/AEG9T/8AAuT/ABo/4SbXv+g3qf8A4Fyf40WA+n6K+YP+Em17/oN6n/4Fyf40f8JNr3/Qb1P/AMC5P8aLAfT9FfMH/CTa9/0G9T/8C5P8aP8AhJte/wCg3qf/AIFyf40WA+n68q+OGs2T2Nto8cu++SdbiRV5Ea7WADHsTuBA9OeMjPmv/CTa9/0G9T/8C5P8ay5pZJ5nlmdpJXYs7uclieSSe5oAbRRRTAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=";

const NAMES = { operator: "Olivia Martinez", sanitation: "Sam Rivera", qa: "Quinn Patel" };

async function seedState() {
  const [op, san, qa] = await Promise.all([
    prisma.worker.findFirst({ where: { roles: { contains: "OPERATOR" }, NOT: { roles: { contains: "ADMIN" } } } }),
    prisma.worker.findFirst({ where: { roles: { contains: "SANITATION" }, NOT: { roles: { contains: "ADMIN" } } } }),
    prisma.worker.findFirst({ where: { roles: { contains: "QA" }, NOT: { roles: { contains: "ADMIN" } } } }),
  ]);
  const original = { op: op.name, san: san.name, qa: qa.name };
  await prisma.worker.update({ where: { id: op.id }, data: { name: NAMES.operator } });
  await prisma.worker.update({ where: { id: san.id }, data: { name: NAMES.sanitation } });
  await prisma.worker.update({ where: { id: qa.id }, data: { name: NAMES.qa } });

  // Clean slate with the real fleet assignment: 1–14 FC, 51–78 NFC.
  await prisma.knife.updateMany({
    data: { status: "AVAILABLE", checkedOutById: null, checkedOutAt: null, dueAt: null,
            damageNote: null, damagePhoto: null },
  });
  await prisma.knife.updateMany({ where: { sortKey: { lte: 14 } }, data: { type: "FC" } });
  await prisma.knife.updateMany({ where: { sortKey: { gte: 51 } }, data: { type: "NFC" } });
  // Show the Teams panel in its unconfigured state (placeholder URL, defaults).
  await prisma.setting.deleteMany({ where: { key: { startsWith: "teams." } } });

  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const friday = new Date();
  friday.setDate(friday.getDate() + (((5 - friday.getDay() + 7) % 7) || 7));
  friday.setHours(23, 59, 59, 999);
  const overdue = new Date(Date.now() - 3 * 3600e3);

  const out = (nums, dueAt, at = new Date()) =>
    prisma.knife.updateMany({
      where: { number: { in: nums } },
      data: { status: "CHECKED_OUT", checkedOutById: op.id, checkedOutAt: at, dueAt },
    });
  await out(["2", "6"], endOfToday);
  await out(["51"], friday);
  await out(["9"], overdue, new Date(Date.now() - 9 * 3600e3));
  await prisma.knife.updateMany({ where: { number: { in: ["4", "11"] } }, data: { status: "DIRTY" } });
  await prisma.knife.updateMany({
    where: { number: "13" },
    data: { status: "DAMAGED", damageNote: "Chip in the blade near the tip — found during inspection.",
            damagePhoto: DAMAGE_PHOTO },
  });
  return original;
}

async function restore(original) {
  await prisma.knife.updateMany({
    data: { status: "AVAILABLE", checkedOutById: null, checkedOutAt: null, dueAt: null,
            damageNote: null, damagePhoto: null },
  });
  const find = (n) => prisma.worker.findFirst({ where: { name: n } });
  for (const [key, name] of [["operator", original.op], ["sanitation", original.san], ["qa", original.qa]]) {
    const w = await find(NAMES[key]);
    if (w) await prisma.worker.update({ where: { id: w.id }, data: { name } });
  }
}

const original = await seedState();
const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

try {
  // ---------- Kiosk ----------
  const k = await browser.newPage({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2, timezoneId: TZID });
  await k.goto(`${BASE}/kiosk`, { waitUntil: "networkidle" });
  await k.waitForTimeout(700);
  await shot(k, "kiosk-board");

  // Step 1 — PIN pad
  await k.locator('button[title^="#1 —"]').first().click();
  await k.waitForTimeout(400);
  const modal = k.locator("div.shadow-xl").first();
  await shot(modal, "kiosk-pin");

  // Step 2 — confirm name + due-back notice
  await enterPin(k, "1111");
  await k.getByRole("button", { name: /Siguiente/ }).click();
  await k.waitForTimeout(700);
  await shot(modal, "kiosk-confirm");
  await k.getByRole("button", { name: /Not me/ }).click();
  await k.waitForTimeout(200);
  await k.keyboard.press("Escape").catch(() => {});

  // Step 3 — sanitation checklist, damaged branch with photo
  await k.goto(`${BASE}/kiosk`, { waitUntil: "networkidle" });
  await k.locator('button[title^="#4 —"]').first().click();
  await k.waitForTimeout(300);
  await enterPin(k, "2222");
  await k.getByRole("button", { name: /Siguiente/ }).click();
  await k.waitForTimeout(600);
  await k.getByRole("button", { name: /Yes — continue/ }).click();
  await k.waitForTimeout(400);
  await k.getByRole("button", { name: "Yes / Sí" }).first().click();
  await k.getByRole("button", { name: "Yes / Sí" }).nth(1).click();
  await shot(k.locator("div.shadow-xl").first(), "kiosk-checklist");
  await k.getByRole("button", { name: /Damaged/ }).click();
  await k.getByPlaceholder(/Describe the damage/).fill("Chip in the blade near the tip.");
  await k.waitForTimeout(200);
  await shot(k.locator("div.shadow-xl").first(), "kiosk-checklist-damaged");
  await k.close();

  // ---------- Fleet board (admin) ----------
  const a = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, timezoneId: TZID });
  await a.goto(BASE, { waitUntil: "networkidle" });
  await enterPin(a, "0000");
  await a.getByRole("button", { name: "Enter" }).click();
  await a.waitForTimeout(900);
  await shot(a, "board-fleet");

  // Damaged knife modal — what the manager sees
  await a.locator('button[title^="Knife #13 —"]').first().click();
  await a.waitForTimeout(500);
  await shot(a.locator("div.shadow-xl").first(), "board-damaged");
  await a.keyboard.press("Escape").catch(() => {});
  await a.mouse.click(5, 5);
  await a.waitForTimeout(300);

  // ---------- Reports ----------
  await a.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  await a.waitForTimeout(600);
  await shot(a, "reports", { fullPage: true });

  // ---------- Admin ----------
  await a.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await a.waitForTimeout(600);
  const card = (name) => a.locator("div.rounded-xl").filter({ has: a.getByRole("heading", { name, exact: true }) }).first();
  await shot(card("Knives"), "admin-knives");
  await shot(card("Workers"), "admin-workers");
  await a.getByText("Advanced", { exact: true }).click();
  await a.waitForTimeout(400);
  await shot(a.locator("details").first(), "admin-advanced");
  await a.close();

  // ---------- What a manager sees on the same page ----------
  const { hashPin } = await import("../src/lib/crypto.ts").catch(() => ({ hashPin: null }));
  if (hashPin) {
    await prisma.worker.deleteMany({ where: { name: "Morgan (Manager)" } });
    await prisma.worker.create({
      data: { name: "Morgan (Manager)", pin: hashPin("4444"), roles: "MANAGER", active: true },
    });
    const g = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, timezoneId: TZID });
    await g.goto(BASE, { waitUntil: "networkidle" });
    await enterPin(g, "4444");
    await g.getByRole("button", { name: "Enter" }).click();
    await g.waitForTimeout(900);
    await g.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await g.waitForTimeout(600);
    await shot(g, "admin-manager", { clip: { x: 0, y: 0, width: 1280, height: 900 } });
    await g.close();
    await prisma.worker.deleteMany({ where: { name: "Morgan (Manager)" } });
  }
  console.log("screenshots written to docs/img/");
} finally {
  await browser.close();
  await restore(original);
  await prisma.$disconnect();
}
