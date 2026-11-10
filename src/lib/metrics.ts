import { prisma } from "./prisma";
import { isOverdue } from "./status";

// End-of-shift sweep: every device still checked out, soonest-due first.
export async function getCheckedOutReport() {
  const devices = await prisma.device.findMany({
    where: { status: "CHECKED_OUT" },
    include: { checkedOutBy: { select: { name: true } } },
    orderBy: { dueAt: "asc" },
  });
  return devices.map((k) => ({
    number: k.number,
    type: k.type,
    holder: k.checkedOutBy?.name ?? "—",
    checkedOutAt: k.checkedOutAt,
    dueAt: k.dueAt,
    overdue: isOverdue(k.status, k.dueAt),
  }));
}

export type FleetMetrics = {
  totalCheckouts: number;
  damageReports: number;
  cyclesMeasured: number;
  avgTimeOutMs: number | null; // checkout -> check-in
  mostUsed: { number: string; count: number }[];
};

// Aggregate the immutable event log into fleet-level metrics.
export async function getMetrics(): Promise<FleetMetrics> {
  const [events, devices] = await Promise.all([
    prisma.deviceEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: { deviceId: true, action: true, createdAt: true },
    }),
    prisma.device.findMany({ select: { id: true, number: true } }),
  ]);
  const numById = new Map(devices.map((k) => [k.id, k.number]));

  const checkoutCount = new Map<number, number>();
  let damageReports = 0;
  const lastCheckout = new Map<number, Date>();
  const timesOut: number[] = [];

  for (const e of events) {
    switch (e.action) {
      case "CHECKOUT":
        checkoutCount.set(e.deviceId, (checkoutCount.get(e.deviceId) ?? 0) + 1);
        lastCheckout.set(e.deviceId, e.createdAt);
        break;
      // Either check-in ends the cycle; a damaged return also counts as a report.
      case "DAMAGE":
        damageReports++;
      // falls through
      case "RETURN": {
        const c = lastCheckout.get(e.deviceId);
        if (c) {
          timesOut.push(e.createdAt.getTime() - c.getTime());
          lastCheckout.delete(e.deviceId);
        }
        break;
      }
    }
  }

  const totalCheckouts = [...checkoutCount.values()].reduce((a, b) => a + b, 0);
  const avgTimeOutMs = timesOut.length
    ? timesOut.reduce((a, b) => a + b, 0) / timesOut.length
    : null;
  const mostUsed = [...checkoutCount.entries()]
    .map(([id, count]) => ({ number: numById.get(id) ?? String(id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalCheckouts,
    damageReports,
    cyclesMeasured: timesOut.length,
    avgTimeOutMs,
    mostUsed,
  };
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}
