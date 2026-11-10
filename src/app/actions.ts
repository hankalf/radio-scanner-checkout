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
import { computeDueDate } from "@/lib/schedule";
import {
  ROLE,
  STATUS,
  hasRole,
  canAccessAdmin,
  canManageConfig,
  canManageWorkers,
  canManageTeams,
  canReturnDamaged,
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
// session (for attribution) and a short-lived admin gate. Admin/QA only.
export async function unlockAdmin(pin: string): Promise<ActionResult> {
  const clean = (pin || "").trim();
  if (!clean) return fail("Enter your PIN.");
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const worker = workers.find((w) => verifyPin(clean, w.pin));
  if (!worker) return fail("PIN not recognized.");
  if (!canAccessAdmin(worker.roles)) {
    return fail("The admin panel is limited to admins, QA, and managers.");
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

// Admin panel is open to admins, QA, and managers (managers read-only).
async function requirePanelAccess(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canAccessAdmin(worker.roles)) {
    return { ok: false, error: "The admin panel is limited to admins, QA, and managers." };
  }
  return { ok: true, workerId: worker.id, roles: worker.roles };
}

// Changing configuration (knives, employees, settings) is admin/QA only —
// managers get a read-only admin panel.
async function requireConfigAccess(): Promise<
  { ok: true; workerId: number; roles: string } | { ok: false; error: string }
> {
  const worker = await getCurrentWorker();
  if (!worker) return { ok: false, error: "Sign in with your PIN first." };
  if (!canManageConfig(worker.roles)) {
    return {
      ok: false,
      error: "Managers have read-only access — ask an admin to make this change.",
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
  // extra data to write onto the knife
  data?: Record<string, unknown>;
  // optional extra check (e.g. "only the operator who checked it out may return it")
  guard?: (
    knife: { checkedOutById: number | null; number: string },
    ctx: GuardContext
  ) => string | null;
};

// Core transition, given an already-resolved actor. Used by both the
// session-based board actions and the PIN-based kiosk actions.
async function applyTransition(
  knifeId: number,
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
      const knife = await tx.knife.findUnique({ where: { id: knifeId } });
      if (!knife) throw new Error("Knife not found.");
      if (!opts.from.includes(knife.status)) {
        throw new Error(
          `Knife #${knife.number} is "${knife.status}" and cannot be ${opts.action}.`
        );
      }
      if (opts.guard) {
        const err = opts.guard(knife, actor);
        if (err) throw new Error(err);
      }
      await tx.knife.update({
        where: { id: knifeId },
        data: { status: opts.to, ...(opts.data ?? {}) },
      });
      await tx.knifeEvent.create({
        data: {
          knifeId,
          workerId: actor.workerId,
          action: opts.action,
          fromStatus: knife.status,
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

// Session-based transition (main board): actor comes from the signed-in cookie.
async function transition(knifeId: number, opts: TransitionOpts): Promise<ActionResult> {
  const auth = await requireWorkerWithRole(opts.role);
  if (!auth.ok) return fail(auth.error);
  return applyTransition(knifeId, opts, { workerId: auth.workerId, roles: auth.roles });
}

// Resolve a worker from a raw PIN (for the shared kiosk, which has no session).
async function actorFromPin(pin: string): Promise<Actor | null> {
  const clean = (pin || "").trim();
  if (!clean) return null;
  const workers = await prisma.worker.findMany({ where: { active: true } });
  const worker = workers.find((w) => verifyPin(clean, w.pin));
  return worker ? { workerId: worker.id, roles: worker.roles } : null;
}

type KioskAction = "CHECKOUT" | "RETURN" | "CLEAN";

// Which role each kiosk action needs.
const ACTION_ROLE: Record<KioskAction, Role> = {
  CHECKOUT: ROLE.OPERATOR,
  RETURN: ROLE.OPERATOR,
  CLEAN: ROLE.SANITATION,
};

async function kioskIsLocked(): Promise<boolean> {
  const locked = await prisma.setting.findUnique({ where: { key: "kioskLocked" } });
  return locked?.value === "true";
}

// Step 1 of the kiosk flow: verify the PIN and return who this is, so the
// worker can confirm their name before the action executes. Nothing changes yet.
export async function kioskIdentify(
  knifeId: number,
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

  // Check the role fits the action now, so a wrong-role PIN fails at this
  // step rather than after the worker confirms their name.
  const role = ACTION_ROLE[action];
  if (!hasRole(worker.roles, role)) {
    return { ok: false, error: `This action requires the ${role} role.` };
  }

  // For a checkout, tell the confirm screen when the knife will be due back —
  // computed server-side so it matches exactly what checkout will stamp.
  if (action === "CHECKOUT") {
    const knife = await prisma.knife.findUnique({ where: { id: knifeId }, select: { type: true } });
    if (knife) {
      return { ok: true, name: worker.name, dueAtMs: computeDueDate(knife.type, new Date()).getTime() };
    }
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

// From the Admin panel (signed-in admin).
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
    return fail("Only an admin or QA can lock or unlock the kiosk.");
  }
  await writeKioskLocked(locked);
  return ok();
}

// Kiosk operator actions: check out / check in. (Sanitation cleaning goes
// through kioskClean below because it carries the inspection checklist.)
// Post a live Teams alert for a kiosk action, if that alert type is enabled.
async function notifyKioskAction(
  knifeId: number,
  workerId: number,
  kind: "checkout" | "checkin" | "cleaned"
): Promise<void> {
  const cfg = await getTeamsConfig();
  const wanted =
    kind === "checkout" ? cfg.notifyCheckout : kind === "checkin" ? cfg.notifyCheckin : cfg.notifyCleaned;
  if (!cfg.enabled || !wanted || !cfg.webhookUrl) return;
  const [knife, worker] = await Promise.all([
    prisma.knife.findUnique({ where: { id: knifeId }, select: { number: true, dueAt: true } }),
    prisma.worker.findUnique({ where: { id: workerId }, select: { name: true } }),
  ]);
  const who = worker?.name ?? "Someone";
  const text =
    kind === "checkout"
      ? `🔪 Knife #${knife?.number} checked out by ${who}${knife?.dueAt ? ` — due back ${knife.dueAt.toLocaleString()}` : ""}.`
      : kind === "checkin"
        ? `↩️ Knife #${knife?.number} checked in by ${who} — awaiting sanitation.`
        : `✅ Knife #${knife?.number} cleaned & returned to service by ${who}.`;
  await postToTeams(cfg.webhookUrl, text);
}

export async function kioskAct(
  knifeId: number,
  action: "CHECKOUT" | "RETURN",
  pin: string,
  note?: string
): Promise<ActionResult> {
  if (await kioskIsLocked()) return fail("The kiosk is locked. Ask a supervisor to unlock it.");
  const actor = await actorFromPin(pin);
  if (!actor) return fail("PIN not recognized.");
  const trimmed = (note || "").trim() || undefined;

  if (action === "CHECKOUT") {
    const knife = await prisma.knife.findUnique({ where: { id: knifeId }, select: { type: true } });
    if (!knife) return fail("Knife not found.");
    const now = new Date();
    const due = computeDueDate(knife.type, now);
    const res = await applyTransition(
      knifeId,
      {
        action: "CHECKOUT",
        from: [STATUS.AVAILABLE],
        to: STATUS.CHECKED_OUT,
        role: ROLE.OPERATOR,
        data: { checkedOutById: actor.workerId, checkedOutAt: now, dueAt: due },
        note: trimmed,
      },
      actor
    );
    if (res.ok) await notifyKioskAction(knifeId, actor.workerId, "checkout");
    return res;
  }
  // RETURN
  const res = await applyTransition(
    knifeId,
    {
      action: "RETURN",
      from: [STATUS.CHECKED_OUT],
      to: STATUS.DIRTY,
      role: ROLE.OPERATOR,
      data: { checkedOutById: null, checkedOutAt: null, dueAt: null },
      note: trimmed,
      guard: (knife, ctx) =>
        knife.checkedOutById === ctx.workerId || hasRole(ctx.roles, ROLE.ADMIN)
          ? null
          : `Knife #${knife.number} was checked out by someone else — only they (or an admin) can return it.`,
    },
    actor
  );
  if (res.ok) await notifyKioskAction(knifeId, actor.workerId, "checkin");
  return res;
}

export type CleanAnswers = {
  cleaned: boolean;
  inspected: boolean;
  condition: "GOOD" | "DAMAGED";
  damageReason?: string;
  damagePhoto?: string; // optional data-URL photo (downscaled client-side)
};

// Sanitation cleaning with the 4-question inspection checklist. A "Good"
// knife returns to service; a "Damaged" one is held for a manager.
export async function kioskClean(
  knifeId: number,
  pin: string,
  answers: CleanAnswers
): Promise<ActionResult> {
  if (await kioskIsLocked()) return fail("The kiosk is locked. Ask a supervisor to unlock it.");
  const actor = await actorFromPin(pin);
  if (!actor) return fail("PIN not recognized.");
  if (!hasRole(actor.roles, ROLE.SANITATION)) {
    return fail("This action requires the SANITATION role.");
  }

  const reason = (answers.damageReason || "").trim();

  if (answers.condition === "DAMAGED") {
    if (!reason) return fail("Describe the damage before submitting.");
    const photo = (answers.damagePhoto || "").trim();
    if (photo) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(photo)) {
        return fail("Damage photo must be a PNG, JPG, or WEBP image.");
      }
      if (photo.length > 1_400_000) return fail("Damage photo is too large.");
    }
    const res = await applyTransition(
      knifeId,
      {
        action: "DAMAGE",
        from: [STATUS.DIRTY, STATUS.CLEANED],
        to: STATUS.DAMAGED,
        role: ROLE.SANITATION,
        data: { damageNote: reason, damagePhoto: photo || null, checkedOutById: null, checkedOutAt: null, dueAt: null },
        note: `Cleaned: ${answers.cleaned ? "Y" : "N"}, Inspected: ${answers.inspected ? "Y" : "N"}, Condition: Damaged — ${reason}`,
      },
      actor
    );
    // Live Teams notification so a manager knows a knife needs review.
    if (res.ok) {
      const cfg = await getTeamsConfig();
      if (cfg.enabled && cfg.notifyDamaged && cfg.webhookUrl) {
        const knife = await prisma.knife.findUnique({ where: { id: knifeId }, select: { number: true } });
        const worker = await prisma.worker.findUnique({ where: { id: actor.workerId }, select: { name: true } });
        await postToTeams(
          cfg.webhookUrl,
          `⚠️ Knife #${knife?.number} flagged **damaged** by ${worker?.name}: ${reason} — needs a manager to review.`
        );
      }
    }
    return res;
  }

  // Good: must be cleaned AND inspected to return to service.
  if (!answers.cleaned || !answers.inspected) {
    return fail("Knife must be marked cleaned and inspected before returning to service.");
  }
  const cleanRes = await applyTransition(
    knifeId,
    {
      action: "CLEAN",
      from: [STATUS.DIRTY, STATUS.CLEANED],
      to: STATUS.AVAILABLE,
      role: ROLE.SANITATION,
      data: { damageNote: null, damagePhoto: null, checkedOutById: null, checkedOutAt: null, dueAt: null },
      note: "Cleaned: Y, Inspected: Y, Condition: Good",
    },
    actor
  );
  if (cleanRes.ok) await notifyKioskAction(knifeId, actor.workerId, "cleaned");
  return cleanRes;
}

// Manager (admin) returns a damaged knife to service after review.
export async function returnDamagedToService(knifeId: number): Promise<ActionResult> {
  const worker = await getCurrentWorker();
  if (!worker) return fail("Sign in with your PIN first.");
  if (!canReturnDamaged(worker.roles)) {
    return fail("Only QA, a manager, or an admin can return a damaged knife to service.");
  }
  const auth = { ok: true as const, workerId: worker.id, roles: worker.roles };
  return applyTransition(
    knifeId,
    {
      action: "MANAGER_RETURN",
      from: [STATUS.DAMAGED],
      to: STATUS.AVAILABLE,
      role: ROLE.ADMIN,
      data: { damageNote: null, damagePhoto: null, checkedOutById: null, checkedOutAt: null, dueAt: null },
    },
    { workerId: auth.workerId, roles: auth.roles },
    true // already authorized above (manager or admin)
  );
}

// ---- Lifecycle actions ----------------------------------------------------

export async function checkoutKnife(knifeId: number): Promise<ActionResult> {
  const auth = await requireWorkerWithRole(ROLE.OPERATOR);
  if (!auth.ok) return fail(auth.error);
  const knife = await prisma.knife.findUnique({ where: { id: knifeId }, select: { type: true } });
  if (!knife) return fail("Knife not found.");
  const now = new Date();
  const due = computeDueDate(knife.type, now);
  return transition(knifeId, {
    action: "CHECKOUT",
    from: [STATUS.AVAILABLE],
    to: STATUS.CHECKED_OUT,
    role: ROLE.OPERATOR,
    data: { checkedOutById: auth.workerId, checkedOutAt: now, dueAt: due },
  });
}

export async function returnKnife(knifeId: number): Promise<ActionResult> {
  return transition(knifeId, {
    action: "RETURN",
    from: [STATUS.CHECKED_OUT],
    to: STATUS.DIRTY,
    role: ROLE.OPERATOR,
    data: { checkedOutById: null, checkedOutAt: null, dueAt: null },
    // Only the operator who holds the knife may return it (admins can override).
    guard: (knife, ctx) =>
      knife.checkedOutById === ctx.workerId || hasRole(ctx.roles, ROLE.ADMIN)
        ? null
        : `Knife #${knife.number} was checked out by someone else — only they (or an admin) can return it.`,
  });
}

// Cleaning returns the knife straight to service — there is no separate QA
// step. CLEANED is accepted as a source for legacy knives stuck in that state.
export async function cleanKnife(knifeId: number): Promise<ActionResult> {
  return transition(knifeId, {
    action: "CLEAN",
    from: [STATUS.DIRTY, STATUS.CLEANED],
    to: STATUS.AVAILABLE,
    role: ROLE.SANITATION,
    data: { checkedOutById: null, checkedOutAt: null, dueAt: null },
  });
}

// ---- Batch actions (sanitation moves many knives at once) ------------------

export type BatchResult = { ok: boolean; done: number; failed: number; error?: string };

async function runBatch(
  ids: number[],
  fn: (id: number) => Promise<ActionResult>
): Promise<BatchResult> {
  let done = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const id of ids) {
    const res = await fn(id);
    if (res.ok) done++;
    else {
      failed++;
      if (!firstError) firstError = res.error;
    }
  }
  return { ok: done > 0, done, failed, error: failed > 0 ? firstError : undefined };
}

export async function batchClean(ids: number[]): Promise<BatchResult> {
  return runBatch(ids, cleanKnife);
}

export async function retireKnife(knifeId: number, reason: string): Promise<ActionResult> {
  const auth = await requirePanelAccess();
  if (!auth.ok) return fail(auth.error);
  return applyTransition(
    knifeId,
    {
      action: "RETIRE",
      from: [STATUS.AVAILABLE, STATUS.CHECKED_OUT, STATUS.DIRTY, STATUS.CLEANED, STATUS.DAMAGED],
      to: STATUS.OUT_OF_SERVICE,
      role: ROLE.ADMIN,
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

export async function restoreKnife(knifeId: number): Promise<ActionResult> {
  const auth = await requirePanelAccess();
  if (!auth.ok) return fail(auth.error);
  return applyTransition(
    knifeId,
    {
      action: "RESTORE",
      from: [STATUS.OUT_OF_SERVICE],
      to: STATUS.DIRTY,
      role: ROLE.ADMIN,
      data: { retiredAt: null },
    },
    { workerId: auth.workerId, roles: auth.roles },
    true
  );
}

// ---- Admin: fleet & workers ----------------------------------------------

export async function addKnife(number: string, type: string = "FC"): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const label = (number || "").trim();
  if (!/^\d+$/.test(label)) return fail("Knife number must be a positive whole number.");
  const sortKey = Number(label);
  const knifeType = type === "NFC" ? "NFC" : "FC";

  const existing = await prisma.knife.findUnique({ where: { number: label } });
  if (existing) return fail(`Knife #${label} already exists.`);

  try {
    await prisma.$transaction(async (tx) => {
      const knife = await tx.knife.create({
        data: { number: label, sortKey, status: STATUS.AVAILABLE, type: knifeType },
      });
      await tx.knifeEvent.create({
        data: {
          knifeId: knife.id,
          workerId: auth.workerId,
          action: "ADD",
          fromStatus: null,
          toStatus: STATUS.AVAILABLE,
          note: `Added to fleet (${knifeType})`,
        },
      });
    });
  } catch {
    return fail("Could not add knife.");
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function setKnifeType(knifeId: number, type: string): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const knifeType = type === "NFC" ? "NFC" : "FC";
  try {
    await prisma.$transaction(async (tx) => {
      const knife = await tx.knife.findUnique({ where: { id: knifeId } });
      if (!knife) throw new Error("Knife not found.");
      if (knife.type === knifeType) return;
      await tx.knife.update({ where: { id: knifeId }, data: { type: knifeType } });
      await tx.knifeEvent.create({
        data: {
          knifeId,
          workerId: auth.workerId,
          action: "RETYPE",
          fromStatus: knife.status,
          toStatus: knife.status,
          note: `Type set to ${knifeType}`,
        },
      });
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update type.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Edit a knife's number and/or type from the admin panel.
export async function updateKnifeDetails(
  knifeId: number,
  input: { number: string; type: string }
): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  const label = (input.number || "").trim();
  if (!/^\d+$/.test(label)) return fail("Knife number must be a positive whole number.");
  const sortKey = Number(label);
  const knifeType = input.type === "NFC" ? "NFC" : "FC";

  try {
    await prisma.$transaction(async (tx) => {
      const knife = await tx.knife.findUnique({ where: { id: knifeId } });
      if (!knife) throw new Error("Knife not found.");
      if (label !== knife.number) {
        const clash = await tx.knife.findUnique({ where: { number: label } });
        if (clash) throw new Error(`Knife #${label} already exists.`);
      }
      if (label === knife.number && knifeType === knife.type) return;
      await tx.knife.update({
        where: { id: knifeId },
        data: { number: label, sortKey, type: knifeType },
      });
      await tx.knifeEvent.create({
        data: {
          knifeId,
          workerId: auth.workerId,
          action: "EDIT",
          fromStatus: knife.status,
          toStatus: knife.status,
          note: `Edited: #${knife.number} (${knife.type}) → #${label} (${knifeType})`,
        },
      });
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not update knife.");
  }
  revalidatePath("/", "layout");
  return ok();
}

// Permanently delete a knife and its audit history. For mis-added knives;
// use Retire to take a real knife out of service while keeping its history.
export async function deleteKnife(knifeId: number): Promise<ActionResult> {
  const auth = await requireConfigAccess();
  if (!auth.ok) return fail(auth.error);
  try {
    const knife = await prisma.knife.findUnique({ where: { id: knifeId } });
    if (!knife) return fail("Knife not found.");
    if (knife.status === STATUS.CHECKED_OUT) {
      return fail("Return this knife before removing it.");
    }
    await prisma.$transaction([
      prisma.knifeEvent.deleteMany({ where: { knifeId } }),
      prisma.knife.delete({ where: { id: knifeId } }),
    ]);
  } catch {
    return fail("Could not remove knife.");
  }
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
  const eventCount = await prisma.knifeEvent.count({ where: { workerId } });
  if (eventCount > 0) {
    return fail(
      "This employee has activity history — deactivate them instead so the audit trail stays intact."
    );
  }
  if (await prisma.knife.count({ where: { checkedOutById: workerId } })) {
    return fail("This employee currently holds a knife — return it first.");
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
          "teams.notifyCleaned",
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
    notifyCleaned: map.get("teams.notifyCleaned") === "true",
  };
}

export async function updateTeamsSettings(input: {
  enabled: boolean;
  webhookUrl: string;
  notifyDamaged: boolean;
  notifyOverdue: boolean;
  notifyCheckout: boolean;
  notifyCheckin: boolean;
  notifyCleaned: boolean;
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
      !input.notifyCheckin &&
      !input.notifyCleaned
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
    ["teams.notifyCleaned", String(input.notifyCleaned)],
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
  const err = await postToTeams(cfg.webhookUrl, "✅ Safety Knife Checkout — Teams notifications are connected.");
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
    if (roles.length === 0) { errors.push(`Row ${rowNo} (${name}): no valid roles (OPERATOR/SANITATION/QA/ADMIN).`); skipped++; continue; }
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
