import { prisma } from "./prisma";

export type TeamsSettings = {
  enabled: boolean;
  webhookUrl: string;
  notifyDamaged: boolean;
  notifyOverdue: boolean;
  notifyCheckout: boolean;
  notifyCheckin: boolean;
  notifyCleaned: boolean;
};

const TEAMS_KEYS = [
  "teams.enabled",
  "teams.webhookUrl",
  "teams.notifyDamaged",
  "teams.notifyOverdue",
  "teams.notifyCheckout",
  "teams.notifyCheckin",
  "teams.notifyCleaned",
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
    notifyCleaned: map.get("teams.notifyCleaned") === "true",
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

export async function getKnives() {
  return prisma.knife.findMany({
    orderBy: { sortKey: "asc" },
    include: { checkedOutBy: { select: { name: true } } },
  });
}

export type KnifeWithHolder = Awaited<ReturnType<typeof getKnives>>[number];

export async function getKnifeByNumber(number: string) {
  return prisma.knife.findUnique({
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
  return prisma.knifeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      worker: { select: { name: true } },
      knife: { select: { number: true } },
    },
  });
}

export async function getAllEventsForExport() {
  return prisma.knifeEvent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      worker: { select: { name: true } },
      knife: { select: { number: true } },
    },
  });
}
