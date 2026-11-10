// Knife lifecycle statuses and the display metadata that drives the color-coded grid.

export const STATUS = {
  AVAILABLE: "AVAILABLE",
  CHECKED_OUT: "CHECKED_OUT",
  DIRTY: "DIRTY",
  CLEANED: "CLEANED",
  DAMAGED: "DAMAGED",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

// Knife type — whether the blade touches food.
export const KNIFE_TYPE = {
  FC: "FC", // Food Contact
  NFC: "NFC", // Non-Food Contact
} as const;

export type KnifeType = (typeof KNIFE_TYPE)[keyof typeof KNIFE_TYPE];

// FC knives are silver/metal (returned daily); NFC knives are blue
// (out for the week, due Friday).
export const TYPE_META: Record<KnifeType, { label: string; short: string; badge: string; dot: string }> = {
  FC: {
    label: "Food Contact",
    short: "FC",
    badge: "bg-slate-300 text-slate-800",
    dot: "bg-slate-300 border border-slate-400",
  },
  NFC: {
    label: "Non-Food Contact",
    short: "NFC",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-600",
  },
};

export function normalizeType(type: string): KnifeType {
  return type === "NFC" ? "NFC" : "FC";
}

export const ROLE = {
  OPERATOR: "OPERATOR",
  SANITATION: "SANITATION",
  QA: "QA",
  // A floor supervisor: can do every lifecycle action, and can VIEW the admin
  // fleet list and audit log — but cannot change any configuration.
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

// "OVERDUE" is a derived display state (a CHECKED_OUT knife past its due time),
// not a stored status. We give it its own visual key.
export type DisplayState = Status | "OVERDUE";

type StatusMeta = {
  label: string;
  // Tailwind classes for the grid tile and the small legend dot.
  tile: string;
  dot: string;
  // Border color used as the status ring around kiosk bubbles.
  ring: string;
};

export const STATUS_META: Record<DisplayState, StatusMeta> = {
  AVAILABLE: {
    label: "Available",
    tile: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600",
    dot: "bg-emerald-500",
    ring: "border-emerald-400",
  },
  CHECKED_OUT: {
    label: "Checked out",
    tile: "bg-sky-500 hover:bg-sky-600 text-white border-sky-600",
    // Bright yellow so the status stays visible on the blue/silver kiosk bubbles.
    dot: "bg-yellow-300",
    ring: "border-yellow-300",
  },
  OVERDUE: {
    label: "Overdue",
    tile: "bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse",
    dot: "bg-red-600",
    // No animate-pulse here: it fades the whole tile and hurts legibility.
    ring: "border-red-500",
  },
  DIRTY: {
    label: "Awaiting sanitation",
    tile: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
    dot: "bg-orange-500",
    ring: "border-orange-500",
  },
  // Legacy state from when a QA-inspection step existed; kept so any knife
  // still in this state renders (sanitation can clean it back to Available).
  CLEANED: {
    label: "Cleaned (legacy)",
    tile: "bg-violet-500 hover:bg-violet-600 text-white border-violet-600",
    dot: "bg-violet-500",
    ring: "border-violet-400",
  },
  DAMAGED: {
    label: "Damaged — needs manager",
    tile: "bg-rose-600 hover:bg-rose-700 text-white border-rose-700",
    dot: "bg-rose-600",
    ring: "border-rose-500",
  },
  OUT_OF_SERVICE: {
    label: "Out of service",
    tile: "bg-slate-400 hover:bg-slate-500 text-white border-slate-500",
    dot: "bg-slate-400",
    ring: "border-slate-500",
  },
};

// Order the legend / summary counts follow. (CLEANED is legacy-only and
// intentionally omitted — cleaning now returns a knife straight to Available.)
export const DISPLAY_ORDER: DisplayState[] = [
  "AVAILABLE",
  "CHECKED_OUT",
  "OVERDUE",
  "DIRTY",
  "DAMAGED",
  "OUT_OF_SERVICE",
];

export function isOverdue(status: string, dueAt: Date | null | undefined): boolean {
  return status === STATUS.CHECKED_OUT && !!dueAt && dueAt.getTime() < Date.now();
}

// The display state used for coloring, folding in the derived OVERDUE state.
export function displayState(status: string, dueAt: Date | null | undefined): DisplayState {
  if (isOverdue(status, dueAt)) return "OVERDUE";
  return status as Status;
}

export function parseRoles(roles: string): Role[] {
  return roles
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r): r is Role => r in ROLE);
}

// Lifecycle capabilities a manager holds implicitly.
const MANAGER_IMPLIES: Role[] = [ROLE.OPERATOR, ROLE.SANITATION, ROLE.QA];

export function hasRole(roles: string, role: Role): boolean {
  const parsed = parseRoles(roles);
  // Admins can perform every function (operator, sanitation, QA, admin).
  if (parsed.includes(ROLE.ADMIN)) return true;
  // Managers cover the floor roles, but never admin.
  if (parsed.includes(ROLE.MANAGER) && MANAGER_IMPLIES.includes(role)) return true;
  return parsed.includes(role);
}

// Who may open the admin panel: admins and QA.
export function canAccessAdmin(roles: string): boolean {
  const parsed = parseRoles(roles);
  return (
    parsed.includes(ROLE.ADMIN) ||
    parsed.includes(ROLE.QA) ||
    parsed.includes(ROLE.MANAGER)
  );
}

// Who may change anything at all in the admin panel. Managers may not, so they
// get the read-only view; the finer-grained checks below apply on top.
export function canManageConfig(roles: string): boolean {
  const parsed = parseRoles(roles);
  return parsed.includes(ROLE.ADMIN) || parsed.includes(ROLE.QA);
}

// Knives: add, edit, remove, and change type.
export function canManageKnives(roles: string): boolean {
  const parsed = parseRoles(roles);
  return parsed.includes(ROLE.ADMIN) || parsed.includes(ROLE.QA);
}

// Employees: add, edit, deactivate, remove, bulk upload. Admin only.
export function canManageWorkers(roles: string): boolean {
  return parseRoles(roles).includes(ROLE.ADMIN);
}

// Teams notification settings. Admin only.
export function canManageTeams(roles: string): boolean {
  return parseRoles(roles).includes(ROLE.ADMIN);
}

// Kiosk logo and the read-only system readout.
export function canManageBranding(roles: string): boolean {
  const parsed = parseRoles(roles);
  return parsed.includes(ROLE.ADMIN) || parsed.includes(ROLE.QA);
}

// Who may put a DAMAGED knife back into service after reviewing it.
export function canReturnDamaged(roles: string): boolean {
  const parsed = parseRoles(roles);
  return (
    parsed.includes(ROLE.ADMIN) ||
    parsed.includes(ROLE.MANAGER) ||
    parsed.includes(ROLE.QA)
  );
}

// The capabilities a worker effectively has — admins get every function.
// Used for client-side button gating so the UI matches `hasRole`.
export function effectiveRoles(roles: string): Role[] {
  const parsed = parseRoles(roles);
  if (parsed.includes(ROLE.ADMIN)) {
    return [ROLE.OPERATOR, ROLE.SANITATION, ROLE.QA, ROLE.MANAGER, ROLE.ADMIN];
  }
  if (parsed.includes(ROLE.MANAGER)) {
    return [...new Set([...MANAGER_IMPLIES, ...parsed])];
  }
  return parsed;
}

// Human labels for audit actions.
export const ACTION_LABEL: Record<string, string> = {
  CHECKOUT: "Checked out",
  RETURN: "Returned (used)",
  CLEAN: "Cleaned & returned to service",
  // Historical actions from when a QA-inspection step existed.
  QA_PASS: "QA passed",
  QA_FAIL: "QA failed",
  RETIRE: "Retired",
  RESTORE: "Restored",
  ADD: "Added to fleet",
  RETYPE: "Type changed",
  EDIT: "Edited",
  DAMAGE: "Flagged damaged",
  MANAGER_RETURN: "Returned to service (manager)",
};
