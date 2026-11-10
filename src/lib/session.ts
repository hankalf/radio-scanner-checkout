import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE = "knife_worker";
const ADMIN_GATE = "knife_admin_gate";

export type CurrentWorker = {
  id: number;
  name: string;
  roles: string;
};

// The worker is identified by a signed-in PIN; we store only their id in a cookie.
export async function getCurrentWorker(): Promise<CurrentWorker | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) return null;
  const worker = await prisma.worker.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, roles: true },
  });
  return worker ?? null;
}

export async function setCurrentWorker(id: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Short-lived shift session; workers re-enter their PIN each shift.
    maxAge: 60 * 60 * 12,
  });
}

export async function clearCurrentWorker(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

// A separate, short-lived gate for the admin dashboard. Entering an admin/QA
// PIN on the admin page sets this; it's required to view the dashboard even
// when the worker is already signed in on the board.
export async function setAdminGate(workerId: number): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_GATE, String(workerId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  });
}

export async function getAdminGateWorkerId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(ADMIN_GATE)?.value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function clearAdminGate(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_GATE);
}
