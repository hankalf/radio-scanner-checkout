import { prisma } from "./prisma";
import { DEFAULT_SHIFT_ENDS, parseShiftEnds } from "./schedule";

export type TeamsSettings = {
  enabled: boolean;
  webhookUrl: string;
  notifyDamaged: boolean;
  notifyOverdue: boolean;
  notifyCheckout: boolean;
  notifyCheckin: boolean;
};

const TEAMS_KEYS = [
  "teams.enabled",
  "teams.webhookUrl",
  "teams.notifyDamaged",
  "teams.notifyOverdue",
  "teams.notifyCheckout",
  "teams.notifyCheckin",
] as const;

export async function getTeamsSettings(): Promise<TeamsSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...TEAMS_KEYS] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get("teams.enabled") === "true",
    webhookUrl: map.get("teams.webhookUrl") ?? "",
    notifyDamaged: (map.get("teams.notifyDamaged") ?? "true") === "true",
    notifyOverdue: (map.get("teams.notifyOverdue") ?? "true") === "true",
    // Per-action alerts are off by default — they're chatty on a busy floor.
    notifyCheckout: map.get("teams.notifyCheckout") === "true",
    notifyCheckin: map.get("teams.notifyCheckin") === "true",
  };
}

// Optional company logo shown in the kiosk's top-left corner. Stored as a
// data: URL in Settings so no file hosting is needed.
export async function getLogoDataUrl(): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key: "branding.logoDataUrl" } });
  return s?.value ? s.value : null;
}

// When true, the shared kiosk is view-only until a supervisor unlocks it.
export async function getKioskLocked(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: "kioskLocked" } });
  return s?.value === "true";
}

// Shift end times (minutes after midnight) that drive due dates.
export async function getShiftEnds(): Promise<number[]> {
  const s = await prisma.setting.findUnique({ where: { key: "shiftEnds" } });
  return parseShiftEnds(s?.value ?? DEFAULT_SHIFT_ENDS);
}

// Radios first, then scanners, each in label order (R001, R002 … S001, S002 …).
export async function getDevices() {
  return prisma.device.findMany({
    orderBy: [{ type: "asc" }, { sortKey: "asc" }, { number: "asc" }],
    include: { checkedOutBy: { select: { name: true } } },
  });
}

export type DeviceWithHolder = Awaited<ReturnType<typeof getDevices>>[number];

export async function getDeviceByNumber(number: string) {
  return prisma.device.findUnique({
    where: { number },
    include: {
      checkedOutBy: { select: { name: true } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { worker: { select: { name: true } } },
      },
    },
  });
}

export async function getWorkers() {
  return prisma.worker.findMany({ orderBy: { name: "asc" } });
}

export async function getRecentEvents(limit = 100) {
  return prisma.deviceEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      worker: { select: { name: true } },
      device: { select: { number: true } },
    },
  });
}

export async function getAllEventsForExport() {
  return prisma.deviceEvent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      worker: { select: { name: true } },
      device: { select: { number: true } },
    },
  });
}
