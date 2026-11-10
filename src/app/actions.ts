"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPin, hashPin } from "@/lib/crypto";
import {
  getCurrentWorker,
  setCurrentWorker,
  clearCurrentWorker,
  setAdminGate,
  clearAdminGate,
} from "@/lib/session";
import { computeDueDate, parseShiftEnds, formatShiftEnds } from "@/lib/schedule";
import { getShiftEnds } from "@/lib/data";
import {
  ROLE,
  STATUS,
  hasRole,
  canAccessAdmin,
  canManageConfig,
  canManageWorkers,
  canManageTeams,
  canReturnDamaged,
  TYPE_META,
  normalizeType,
  parseDeviceLabel,
  type Role,
} from "@/lib/status";

export type ActionResult = { ok: boolean; error?: string };

function ok(): ActionResult {
  return { ok: true };
}
function fail(error: string): ActionResult {
  return { ok: false, error };
}

// ---- Identity -------------------------------------------------------------

export async function login(pin: string): Promise<ActionResult> {
  const clean = (pin || "").trim();
  if (!clean) return fail("Enter your PIN.");
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const match = workers.find((w) => verifyPin(clean, w.pin));
  if (!match) return fail("PIN not recognized.");
  await setCurrentWorker(match.id);
  revalidatePath("/", "layout");
  return ok();
}

export async function logout(): Promise<ActionResult> {
  await clearCurrentWorker();
  await clearAdminGate();
  revalidatePath("/", "layout");
  return ok();
}

// Verify a PIN specifically to open the admin dashboard. Sets the worker
// session (for attribution) and a short-lived admin gate. Supervisors and admins only.
export async function unlockAdmin(pin: string): Promise<ActionResult> {
  const clean = (pin || "").trim();
  if (!clean) return fail("Enter your PIN.");
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const worker = workers.find((w) => verifyPin(clean, w.pin));
  if (!worker) return fail("PIN not recognized.");
  if (!canAccessAdmin(worker.roles)) {
    return fail("The admin panel is limited to supervisors and admins.");
  }
  await setCurrentWorker(worker.id);
  await setAdminGate(worker.id);
  revalidatePath("/", "layout");
  return ok();
}

// ---- Shared transition core ----------------------------------------------

async function requireWorkerWithRole(role: Role): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!hasRole(worker.roles, role)) {
    return { ok: false, error: `This action requires the ${role} role.` };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

// Admin panel is open to supervisors and admins.
async function requirePanelAccess(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canAccessAdmin(worker.roles)) {
    return { ok: false, error: "The admin panel is limited to supervisors and admins." };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

// Changing device configuration and kiosk settings: supervisors and admins.
async function requireConfigAccess(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canManageConfig(worker.roles)) {
    return {
      ok: false,
      error: "Only a supervisor or admin can make this change.",
    };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

// Employee management is admin-only.
async function requireWorkerAdmin(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canManageWorkers(worker.roles)) {
    return { ok: false, error: "Only an admin can manage employees." };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

// Teams notification settings are admin-only.
async function requireTeamsAdmin(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canManageTeams(worker.roles)) {
    return { ok: false, error: "Only an admin can change Teams notification settings." };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

type Actor = { workerId: number; roles: string };
type GuardContext = Actor;

type TransitionOpts = {
  action: string;
  from: string[]; // allowed source statuses
  to: string;
  role: Role;
  note?: string;
  // extra data to write onto the device
  data?: Record<string, unknown>;
  // optional extra check (e.g. "only the operator who checked it out may return it")
  guard?: (
    device: { checkedOutById: number | null; number: string },
    ctx: GuardContext
  ) => string | null;
};

// Core transition, given an already-resolved actor. Used by both the
// session-based board actions and the PIN-based kiosk actions.
async function applyTransition(
  deviceId: number,
  opts: TransitionOpts,
  actor: Actor,
  // When the caller already authorized the actor (e.g. panel access covers
  // this action), skip the single-role check.
  authorized = false
): Promise<ActionResult> {
  if (!authorized && !hasRole(actor.roles, opts.role)) {
    return fail(`This action requires the ${opts.role} role.`);
  }
  try {
    await prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { id: deviceId } });
      if (!device) throw new Error("Device not found.");
      if (!opts.from.includes(device.status)) {
        throw new Error(
          `${device.number} is "${device.status}" and cannot be ${opts.action}.`
        );
      }
      if (opts.guard) {
        const err = opts.guard(device, actor);
        if (err) throw new Error(err);
      }
      await tx.device.update({
        where: { id: deviceId },
        data: { status: opts.to, ...(opts.data ?? {}) },
      });
      await tx.deviceEvent.create({
        data: {
          deviceId,
          workerId: actor.workerId,
          action: opts.action,
          fromStatus: device.status,
          toStatus: opts.to,
          note: opts.note ?? null,
        },
      });
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Transition failed.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// Resolve a worker from a raw PIN (for the shared kiosk, which has no session).
async function actorFromPin(pin: string): Promise<Actor | null> {
  const clean = (pin || "").trim();
  if (!clean) return null;
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const worker = workers.find((w) => verifyPin(clean, w.pin));
  return worker ? { workerId: worker.id, roles: worker.roles } : null;
}

type KioskAction = "CHECKOUT" | "RETURN";

async function kioskIsLocked(): Promise<boolean> {
  const locked = await prisma.setting.findUnique({ where: { key: "kioskLocked" } });
  return locked?.value === "true";
}

async function dueDateFromNow(now: Date): Promise<Date> {
  return computeDueDate(await getShiftEnds(), now);
}

// Only the operator holding a device may check it in — or a supervisor/admin,
// who can check in a device left behind by someone else.
function holderGuard(
  device: { checkedOutById: number | null; number: string },
  ctx: GuardContext
): string | null {
  return device.checkedOutById === ctx.workerId || canReturnDamaged(ctx.roles)
    ? null
    : `${device.number} was checked out by someone else — only they (or a supervisor) can return it.`;
}

// Step 1 of the kiosk flow: verify the PIN and return who this is, so the
// worker can confirm their name before the action executes. Nothing changes yet.
export async function kioskIdentify(
  deviceId: number,
  action: KioskAction,
  pin: string
): Promise<{ ok: true; name: string; dueAtMs?: number } | { ok: false; error: string }> {
  if (await kioskIsLocked()) {
    return { ok: false, error: "The kiosk is locked. Ask a supervisor to unlock it." };
  }
  const clean = (pin || "").trim();
  if (!clean) return { ok: false, error: "Enter your PIN." };
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const worker = workers.find((w) => verifyPin(clean, w.pin));
  if (!worker) return { ok: false, error: "PIN not recognized." };

  // Check the role (and, for a return, who holds it) now, so a wrong PIN
  // fails at this step rather than after the worker confirms their name.
  if (!hasRole(worker.roles, ROLE.OPERATOR)) {
    return { ok: false, error: "This action requires the OPERATOR role." };
  }
  if (action === "RETURN") {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { number: true, checkedOutById: true },
    });
    if (device) {
      const err = holderGuard(device, { workerId: worker.id, roles: worker.roles });
      if (err) return { ok: false, error: err };
    }
  }

  // For a checkout, tell the confirm screen when the device will be due back —
  // computed server-side so it matches exactly what checkout will stamp.
  if (action === "CHECKOUT") {
    return { ok: true, name: worker.name, dueAtMs: (await dueDateFromNow(new Date())).getTime() };
  }
  return { ok: true, name: worker.name };
}

// ---- Kiosk lock (supervisor view-only toggle) -----------------------------

async function writeKioskLocked(locked: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "kioskLocked" },
    update: { value: String(locked) },
    create: { key: "kioskLocked", value: String(locked) },
  });
  revalidatePath("/", "layout");
}

// From the Admin panel (signed-in supervisor/admin).
export async function setKioskLocked(locked: boolean): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  await writeKioskLocked(locked);
  return ok();
}

// From the kiosk itself — a supervisor confirms with their PIN.
export async function setKioskLockedWithPin(
  locked: boolean,
  pin: string
): Promise<ActionResult> {
  const actor = await actorFromPin(pin);
  if (!actor) return fail("PIN not recognized.");
  if (!canAccessAdmin(actor.roles)) {
    return fail("Only a supervisor or admin can lock or unlock the kiosk.");
  }
  await writeKioskLocked(locked);
  return ok();
}

// Post a live Teams alert for a checkout/check-in, if that alert type is enabled.
async function notifyAction(
  deviceId: number,
  workerId: number,
  kind: "checkout" | "checkin"
): Promise<void> {
  const cfg = await getTeamsConfig();
  const wanted = kind === "checkout" ? cfg.notifyCheckout : cfg.notifyCheckin;
  if (!cfg.enabled || !wanted || !cfg.webhookUrl) return;
  const [device, worker] = await Promise.all([
    prisma.device.findUnique({ where: { id: deviceId }, select: { number: true, type: true, dueAt: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { name: true } }),
  ]);
  const who = worker?.name ?? "Someone";
  const label = device ? `${TYPE_META[normalizeType(device.type)].label} ${device.number}` : "Device";
  const text =
    kind === "checkout"
      ? `📻 ${label} checked out by ${who}${device?.dueAt ? ` — due back ${device.dueAt.toLocaleString()}` : ""}.`
      : `↩️ ${label} returned by ${who} and placed on the charger.`;
  await postToTeams(cfg.webhookUrl, text);
}

async function checkoutAs(deviceId: number, actor: Actor): Promise<ActionResult> {
  const now = new Date();
  const due = await dueDateFromNow(now);
  const res = await applyTransition(
    deviceId,
    {
      action: "CHECKOUT",
      from: [STATUS.AVAILABLE],
      to: STATUS.CHECKED_OUT,
      role: ROLE.OPERATOR,
      data: { checkedOutById: actor.workerId, checkedOutAt: now, dueAt: due },
    },
    actor
  );
  if (res.ok) await notifyAction(deviceId, actor.workerId, "checkout");
  return res;
}

export type ReturnAnswers = {
  onCharger: boolean;
  condition: "GOOD" | "DAMAGED";
  damageReason?: string;
  damagePhoto?: string; // optional data-URL photo (downscaled client-side)
};

// Check-in with the return checklist. A "Good" device goes straight back to
// Available; a "Damaged" one is held until a supervisor reviews it.
async function returnAs(deviceId: number, actor: Actor, answers: ReturnAnswers): Promise<ActionResult> {
  if (!answers.onCharger) {
    return fail("Put the device on its charger before checking it in. · Ponga el equipo en el cargador.");
  }
  const cleared = { checkedOutById: null, checkedOutAt: null, dueAt: null };

  if (answers.condition === "DAMAGED") {
    const reason = (answers.damageReason || "").trim();
    if (!reason) return fail("Describe the damage before submitting.");
    const photo = (answers.damagePhoto || "").trim();
    if (photo) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(photo)) {
        return fail("Damage photo must be a PNG, JPG, or WEBP image.");
      }
      if (photo.length > 1_400_000) return fail("Damage photo is too large.");
    }
    const res = await applyTransition(
      deviceId,
      {
        action: "DAMAGE",
        from: [STATUS.CHECKED_OUT],
        to: STATUS.DAMAGED,
        role: ROLE.OPERATOR,
        data: { ...cleared, damageNote: reason, damagePhoto: photo || null },
        note: `On charger: Y, Condition: Damaged — ${reason}`,
        guard: holderGuard,
      },
      actor
    );
    // Live Teams notification so a supervisor knows a device needs review.
    if (res.ok) {
      const cfg = await getTeamsConfig();
      if (cfg.enabled && cfg.notifyDamaged && cfg.webhookUrl) {
        const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { number: true, type: true } });
        const worker = await prisma.worker.findUnique({ where: { id: actor.workerId }, select: { name: true } });
        const label = device ? `${TYPE_META[normalizeType(device.type)].label} ${device.number}` : "A device";
        await postToTeams(
          cfg.webhookUrl,
          `⚠️ ${label} returned **damaged** by ${worker?.name}: ${reason} — needs a supervisor to review.`
        );
      }
    }
    return res;
  }

  const res = await applyTransition(
    deviceId,
    {
      action: "RETURN",
      from: [STATUS.CHECKED_OUT],
      to: STATUS.AVAILABLE,
      role: ROLE.OPERATOR,
      data: { ...cleared, damageNote: null, damagePhoto: null },
      note: "On charger: Y, Condition: Good",
      guard: holderGuard,
    },
    actor
  );
  if (res.ok) await notifyAction(deviceId, actor.workerId, "checkin");
  return res;
}

// Kiosk checkout (PIN-confirmed).
export async function kioskCheckout(deviceId: number, pin: string): Promise<ActionResult> {
  if (await kioskIsLocked()) return fail("The kiosk is locked. Ask a supervisor to unlock it.");
  const actor = await actorFromPin(pin);
  if (!actor) return fail("PIN not recognized.");
  return checkoutAs(deviceId, actor);
}

// Kiosk check-in with the return checklist (PIN-confirmed).
export async function kioskReturn(
  deviceId: number,
  pin: string,
  answers: ReturnAnswers
): Promise<ActionResult> {
  if (await kioskIsLocked()) return fail("The kiosk is locked. Ask a supervisor to unlock it.");
  const actor = await actorFromPin(pin);
  if (!actor) return fail("PIN not recognized.");
  return returnAs(deviceId, actor, answers);
}

// Supervisor (or admin) returns a damaged device to service after review.
export async function returnDamagedToService(deviceId: number): Promise<ActionResult> {
  const worker = await getCurrentWorker();
  if (!worker) return fail("Sign in with your PIN first.");
  if (!canReturnDamaged(worker.roles)) {
    return fail("Only a supervisor or an admin can return a damaged device to service.");
  }
  return applyTransition(
    deviceId,
    {
      action: "SUPERVISOR_RETURN",
      from: [STATUS.DAMAGED],
      to: STATUS.AVAILABLE,
      role: ROLE.SUPERVISOR,
      data: { damageNote: null, damagePhoto: null, checkedOutById: null, checkedOutAt: null, dueAt: null },
    },
    { workerId: worker.id, roles: worker.roles },
    true // already authorized above
  );
}

// ---- Lifecycle actions (fleet board, signed-in session) --------------------

export async function checkoutDevice(deviceId: number): Promise<ActionResult> {
  const auth = await requireWorkerWithRole(ROLE.OPERATOR);
  if (!auth.ok) return fail(auth.error);
  return checkoutAs(deviceId, { workerId: auth.workerId, roles: auth.roles });
}

export async function returnDevice(deviceId: number, answers: ReturnAnswers): Promise<ActionResult> {
  const auth = await requireWorkerWithRole(ROLE.OPERATOR);
  if (!auth.ok) return fail(auth.error);
  return returnAs(deviceId, { workerId: auth.workerId, roles: auth.roles }, answers);
}

export async function retireDevice(deviceId: number, reason: string): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  return applyTransition(
    deviceId,
    {
      action: "RETIRE",
      from: [STATUS.AVAILABLE, STATUS.CHECKED_OUT, STATUS.DAMAGED],
      to: STATUS.OUT_OF_SERVICE,
      role: ROLE.SUPERVISOR,
      note: (reason || "").trim() || undefined,
      data: {
        retiredAt: new Date(),
        damageNote: null,
        damagePhoto: null,
        checkedOutById: null,
        checkedOutAt: null,
        dueAt: null,
      },
    },
    { workerId: auth.workerId, roles: auth.roles },
    true
  );
}

export async function restoreDevice(deviceId: number): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  return applyTransition(
    deviceId,
    {
      action: "RESTORE",
      from: [STATUS.OUT_OF_SERVICE],
      to: STATUS.AVAILABLE,
      role: ROLE.SUPERVISOR,
      data: { retiredAt: null },
    },
    { workerId: auth.workerId, roles: auth.roles },
    true
  );
}

// ---- Admin: fleet & workers ----------------------------------------------

export async function addDevice(label: string, type: string = "RADIO"): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const deviceType = normalizeType(type);
  const parsed = parseDeviceLabel(label, deviceType);
  if (!parsed) return fail("Use a label like R21 or S21 (or just a number).");

  const existing = await prisma.device.findUnique({ where: { number: parsed.number } });
  if (existing) return fail(`${parsed.number} already exists.`);

  try {
    await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: { number: parsed.number, sortKey: parsed.sortKey, status: STATUS.AVAILABLE, type: deviceType },
      });
      await tx.deviceEvent.create({
        data: {
          deviceId: device.id,
          workerId: auth.workerId,
          action: "ADD",
          fromStatus: null,
          toStatus: STATUS.AVAILABLE,
          note: `Added to fleet (${TYPE_META[deviceType].label})`,
        },
      });
    });
  } catch {
    return fail("Could not add device.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Edit a device's label and/or type from the admin panel.
export async function updateDeviceDetails(
  deviceId: number,
  input: { number: string; type: string }
): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const deviceType = normalizeType(input.type);
  const parsed = parseDeviceLabel(input.number, deviceType);
  if (!parsed) return fail("Use a label like R21 or S21 (or just a number).");

  try {
    await prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { id: deviceId } });
      if (!device) throw new Error("Device not found.");
      if (parsed.number !== device.number) {
        const clash = await tx.device.findUnique({ where: { number: parsed.number } });
        if (clash) throw new Error(`${parsed.number} already exists.`);
      }
      if (parsed.number === device.number && deviceType === device.type) return;
      await tx.device.update({
        where: { id: deviceId },
        data: { number: parsed.number, sortKey: parsed.sortKey, type: deviceType },
      });
      await tx.deviceEvent.create({
        data: {
          deviceId,
          workerId: auth.workerId,
          action: "EDIT",
          fromStatus: device.status,
          toStatus: device.status,
          note: `Edited: ${device.number} (${device.type}) → ${parsed.number} (${deviceType})`,
        },
      });
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update device.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Permanently delete a device and its audit history. For mis-added devices;
// use Retire to take a real device out of service while keeping its history.
export async function deleteDevice(deviceId: number): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return fail("Device not found.");
    if (device.status === STATUS.CHECKED_OUT) {
      return fail("Check this device in before removing it.");
    }
    await prisma.$transaction([
      prisma.deviceEvent.deleteMany({ where: { deviceId } }),
      prisma.device.delete({ where: { id: deviceId } }),
    ]);
  } catch {
    return fail("Could not remove device.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Shift end times ("07:00, 15:00, 23:00") that set every checkout's due time.
export async function updateShiftEnds(value: string): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const mins = parseShiftEnds(value);
  if (mins.length === 0) return fail("Enter at least one time, like 15:00 (24-hour clock).");
  const clean = formatShiftEnds(mins);
  await prisma.setting.upsert({
    where: { key: "shiftEnds" },
    update: { value: clean },
    create: { key: "shiftEnds", value: clean },
  });
  revalidatePath("/", "layout");
  return ok();
}

export async function addWorker(
  name: string,
  pin: string,
  roles: string[]
): Promise<ActionResult> {
  const auth = await requireWorkerAdmin();
  if (!auth.ok) return fail(auth.error);
  const cleanName = (name || "").trim();
  const cleanPin = (pin || "").trim();
  if (!cleanName) return fail("Name is required.");
  if (!/^\d{4,8}$/.test(cleanPin)) return fail("PIN must be 4–8 digits.");
  const validRoles = roles.filter((r) => r in ROLE);
  if (validRoles.length === 0) return fail("Select at least one role.");

  // Ensure PIN is unique (compare against all stored hashes).
  const all = await prisma.worker.findMany();
  if (all.some((w) => verifyPin(cleanPin, w.pin))) {
    return fail("That PIN is already in use — choose another.");
  }

  try {
    await prisma.worker.create({
      data: { name: cleanName, pin: hashPin(cleanPin), roles: validRoles.join(","), active: true },
    });
  } catch {
    return fail("Could not add worker.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Count active admins other than `excludeId` — used to prevent locking
// everyone out by removing/deactivating the last admin.
async function activeAdminsExcluding(excludeId: number): Promise<number> {
  const workers = await prisma.worker.findMany({ where: { active: true } });
  return workers.filter((w) => w.id !== excludeId && hasRole(w.roles, ROLE.ADMIN)).length;
}

export async function setWorkerActive(
  workerId: number,
  active: boolean
): Promise<ActionResult> {
  const auth = await requireWorkerAdmin();
  if (!auth.ok) return fail(auth.error);
  const target = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!target) return fail("Worker not found.");
  if (!active && hasRole(target.roles, ROLE.ADMIN) && (await activeAdminsExcluding(workerId)) === 0) {
    return fail("You can't deactivate the last admin — add another admin first.");
  }
  await prisma.worker.update({ where: { id: workerId }, data: { active } });
  revalidatePath("/", "layout");
  return ok();
}

export async function updateWorker(
  workerId: number,
  input: { name: string; roles: string[]; pin?: string }
): Promise<ActionResult> {
  const auth = await requireWorkerAdmin();
  if (!auth.ok) return fail(auth.error);

  const cleanName = (input.name || "").trim();
  if (!cleanName) return fail("Name is required.");
  const validRoles = input.roles.filter((r) => r in ROLE);
  if (validRoles.length === 0) return fail("Select at least one role.");

  const target = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!target) return fail("Worker not found.");

  // Don't let the last admin drop their own ADMIN role.
  const losingAdmin = hasRole(target.roles, ROLE.ADMIN) && !validRoles.includes(ROLE.ADMIN);
  if (losingAdmin && target.active && (await activeAdminsExcluding(workerId)) === 0) {
    return fail("You can't remove the last admin's ADMIN role — add another admin first.");
  }

  const data: { name: string; roles: string; pin?: string } = {
    name: cleanName,
    roles: validRoles.join(","),
  };

  const newPin = (input.pin || "").trim();
  if (newPin) {
    if (!/^\d{4,8}$/.test(newPin)) return fail("PIN must be 4–8 digits.");
    const others = await prisma.worker.findMany({ where: { id: { not: workerId } } });
    if (others.some((w) => verifyPin(newPin, w.pin))) {
      return fail("That PIN is already in use — choose another.");
    }
    data.pin = hashPin(newPin);
  }

  await prisma.worker.update({ where: { id: workerId }, data });
  revalidatePath("/", "layout");
  return ok();
}

export async function deleteWorker(workerId: number): Promise<ActionResult> {
  const auth = await requireWorkerAdmin();
  if (!auth.ok) return fail(auth.error);

  const target = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!target) return fail("Worker not found.");

  // Protect the audit trail: anyone with recorded activity can only be deactivated.
  const eventCount = await prisma.deviceEvent.count({ where: { workerId } });
  if (eventCount > 0) {
    return fail(
      "This employee has activity history — deactivate them instead so the audit trail stays intact."
    );
  }
  if (await prisma.device.count({ where: { checkedOutById: workerId } })) {
    return fail("This employee currently has a device checked out — return it first.");
  }
  if (hasRole(target.roles, ROLE.ADMIN) && target.active && (await activeAdminsExcluding(workerId)) === 0) {
    return fail("You can't remove the last admin — add another admin first.");
  }

  await prisma.worker.delete({ where: { id: workerId } });
  revalidatePath("/", "layout");
  return ok();
}

// ---- Microsoft Teams notifications ----------------------------------------

// POST a message to a Teams webhook. Returns an error string on failure, or
// null on success. Never throws.
//
// Teams has two kinds of incoming webhook, which need different payloads:
//  - Legacy "Incoming Webhook" connector (…webhook.office.com…) → { text }.
//  - Power Automate "Workflows" webhook (…logic.azure.com…, the current
//    Microsoft-recommended method) → an Adaptive Card wrapped in an
//    attachments array. A { text } body posts nothing there.
// We pick the shape from the URL so both work.
function teamsPayload(webhookUrl: string, text: string): unknown {
  const isLegacyConnector = /webhook\.office\.com/i.test(webhookUrl);
  if (isLegacyConnector) return { text };
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [{ type: "TextBlock", text, wrap: true }],
        },
      },
    ],
  };
}

// Catch obviously-wrong URLs before posting, with a message that says what to
// paste instead. A Teams *channel link* is the most common mistake — POSTing
// to it returns HTTP 405 because it's a web page, not a webhook.
function teamsUrlProblem(webhookUrl: string): string | null {
  let host = "";
  try {
    host = new URL(webhookUrl).hostname.toLowerCase();
  } catch {
    return "That doesn't look like a valid URL.";
  }
  if (host === "teams.microsoft.com" || host.endsWith(".teams.microsoft.com")) {
    return (
      "That's a link to the Teams channel itself, not a webhook. In Teams: channel → ⋯ → " +
      "Workflows → “Post to a channel when a webhook request is received” → copy the URL it " +
      "gives you (it contains logic.azure.com)."
    );
  }
  return null;
}

async function postToTeams(webhookUrl: string, text: string): Promise<string | null> {
  const problem = teamsUrlProblem(webhookUrl);
  if (problem) return problem;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teamsPayload(webhookUrl, text)),
    });
    if (!res.ok) {
      if (res.status === 405) {
        return (
          "Teams returned HTTP 405 — that URL doesn't accept messages, so it isn't a webhook. " +
          "Create one in Teams: channel → ⋯ → Workflows → “Post to a channel when a webhook " +
          "request is received”, then paste the URL it generates (contains logic.azure.com)."
        );
      }
      const detail = (await res.text().catch(() => "")).slice(0, 300).trim();
      return `Teams returned HTTP ${res.status}${detail ? ` — ${detail}` : ""}.`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? `Could not reach Teams: ${e.message}` : "Could not reach Teams.";
  }
}

async function getTeamsConfig() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "teams.enabled",
          "teams.webhookUrl",
          "teams.notifyDamaged",
          "teams.notifyOverdue",
          "teams.notifyCheckout",
          "teams.notifyCheckin",
        ],
      },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get("teams.enabled") === "true",
    webhookUrl: map.get("teams.webhookUrl") ?? "",
    notifyDamaged: (map.get("teams.notifyDamaged") ?? "true") === "true",
    notifyOverdue: (map.get("teams.notifyOverdue") ?? "true") === "true",
    notifyCheckout: map.get("teams.notifyCheckout") === "true",
    notifyCheckin: map.get("teams.notifyCheckin") === "true",
  };
}

export async function updateTeamsSettings(input: {
  enabled: boolean;
  webhookUrl: string;
  notifyDamaged: boolean;
  notifyOverdue: boolean;
  notifyCheckout: boolean;
  notifyCheckin: boolean;
}): Promise<ActionResult> {
  const auth = await requireTeamsAdmin();
  if (!auth.ok) return fail(auth.error);
  const url = (input.webhookUrl || "").trim();
  if (input.enabled) {
    if (!/^https:\/\/\S+$/.test(url)) return fail("Enter a valid https Teams webhook URL.");
    const problem = teamsUrlProblem(url);
    if (problem) return fail(problem);
    if (
      !input.notifyDamaged &&
      !input.notifyOverdue &&
      !input.notifyCheckout &&
      !input.notifyCheckin
    ) {
      return fail("Choose at least one thing to be notified about.");
    }
  }
  const entries: [string, string][] = [
    ["teams.enabled", String(input.enabled)],
    ["teams.webhookUrl", url],
    ["teams.notifyDamaged", String(input.notifyDamaged)],
    ["teams.notifyOverdue", String(input.notifyOverdue)],
    ["teams.notifyCheckout", String(input.notifyCheckout)],
    ["teams.notifyCheckin", String(input.notifyCheckin)],
  ];
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/", "layout");
  return ok();
}

// Send a test message so an admin can confirm the webhook works.
export async function sendTeamsTest(): Promise<ActionResult> {
  const auth = await requireTeamsAdmin();
  if (!auth.ok) return fail(auth.error);
  const cfg = await getTeamsConfig();
  if (!cfg.webhookUrl) return fail("Add a webhook URL first.");
  const err = await postToTeams(cfg.webhookUrl, "✅ Radio & Scanner Checkout — Teams notifications are connected.");
  return err ? fail(err) : ok();
}

// ---- Company logo (kiosk branding) ----------------------------------------

// Save (or clear) the company logo shown in the kiosk's top-left corner.
// The logo is stored as a data: URL. Pass an empty string to remove it.
export async function updateLogo(dataUrl: string): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const value = (dataUrl || "").trim();
  if (value) {
    if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(value)) {
      return fail("Upload a PNG, JPG, GIF, WEBP, or SVG image.");
    }
    // Data URLs are stored inline; keep them small (~700 KB of base64 ≈ 512 KB image).
    if (value.length > 700_000) return fail("Image is too large — use one under 500 KB.");
  }
  await prisma.setting.upsert({
    where: { key: "branding.logoDataUrl" },
    update: { value },
    create: { key: "branding.logoDataUrl", value },
  });
  revalidatePath("/", "layout");
  return ok();
}

// ---- Bulk worker upload (CSV) ---------------------------------------------

export type BulkResult = { ok: boolean; added: number; skipped: number; errors: string[] };

// Parse a CSV of "name,pin,roles" (roles separated by ; | or space) and create
// the workers. Header row optional. Existing/duplicate PINs are skipped.
export async function bulkAddWorkers(csv: string): Promise<BulkResult> {
  const auth = await requireWorkerAdmin();
  if (!auth.ok) return { ok: false, added: 0, skipped: 0, errors: [auth.error] };

  const lines = (csv || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, added: 0, skipped: 0, errors: ["The file is empty."] };
  // Drop a header row if present.
  if (/^\s*name\s*,/i.test(lines[0])) lines.shift();

  const existing = await prisma.worker.findMany();
  const usedPins = new Set<string>(); // within this upload
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [i, line] of lines.entries()) {
    const cols = line.split(",").map((c) => c.trim());
    const name = cols[0] ?? "";
    const pin = cols[1] ?? "";
    const rolesRaw = cols.slice(2).join(",");
    const rowNo = i + 1;

    if (!name) { errors.push(`Row ${rowNo}: missing name.`); skipped++; continue; }
    if (!/^\d{4,8}$/.test(pin)) { errors.push(`Row ${rowNo} (${name}): PIN must be 4–8 digits.`); skipped++; continue; }
    const roles = rolesRaw.split(/[;| ]+/).map((r) => r.trim().toUpperCase()).filter((r) => r in ROLE);
    if (roles.length === 0) { errors.push(`Row ${rowNo} (${name}): no valid roles (OPERATOR/SUPERVISOR/ADMIN).`); skipped++; continue; }
    if (usedPins.has(pin) || existing.some((w) => verifyPin(pin, w.pin))) {
      errors.push(`Row ${rowNo} (${name}): PIN already in use.`); skipped++; continue;
    }

    try {
      await prisma.worker.create({ data: { name, pin: hashPin(pin), roles: roles.join(","), active: true } });
      usedPins.add(pin);
      added++;
    } catch {
      errors.push(`Row ${rowNo} (${name}): could not be added.`);
      skipped++;
    }
  }

  revalidatePath("/", "layout");
  return { ok: added > 0, added, skipped, errors };
}
