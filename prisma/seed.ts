import { PrismaClient } from "@prisma/client";
import { hashPin } from "../src/lib/crypto";
import { DEFAULT_SHIFT_ENDS } from "../src/lib/schedule";

const prisma = new PrismaClient();

// The starting fleet: 20 radios (R1–R20) and 20 scanners (S1–S20).
// Add, relabel, or remove devices later from the Admin screen.
const FLEET: { prefix: string; type: "RADIO" | "SCANNER"; count: number }[] = [
  { prefix: "R", type: "RADIO", count: 20 },
  { prefix: "S", type: "SCANNER", count: 20 },
];

// Starter workers so every role can be exercised immediately.
// PINs are only defaults — change them in the Admin screen.
const workers = [
  { name: "Admin", pin: "0000", roles: "ADMIN" },
  { name: "Olivia (Operator)", pin: "1111", roles: "OPERATOR" },
  { name: "Sam (Supervisor)", pin: "2222", roles: "SUPERVISOR" },
];

async function main() {
  // Devices — only seeded into an empty fleet, so devices an admin removed or
  // relabeled are never re-created on the next deploy.
  if ((await prisma.device.count()) === 0) {
    for (const { prefix, type, count } of FLEET) {
      for (let n = 1; n <= count; n++) {
        await prisma.device.create({
          data: { number: `${prefix}${n}`, sortKey: n, status: "AVAILABLE", type },
        });
      }
    }
  }

  // Workers.
  for (const w of workers) {
    const existing = await prisma.worker.findFirst({ where: { name: w.name } });
    if (existing) continue;
    await prisma.worker.create({
      data: { name: w.name, pin: hashPin(w.pin), roles: w.roles, active: true },
    });
  }

  // Settings.
  await prisma.setting.upsert({
    where: { key: "shiftEnds" },
    update: {},
    create: { key: "shiftEnds", value: DEFAULT_SHIFT_ENDS },
  });

  const deviceCount = await prisma.device.count();
  const workerCount = await prisma.worker.count();
  console.log(`Seed complete: ${deviceCount} devices, ${workerCount} workers.`);
  console.log("Default PINs — Admin 0000, Operator 1111, Supervisor 2222");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
