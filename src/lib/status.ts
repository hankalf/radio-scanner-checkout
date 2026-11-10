// Device lifecycle statuses and the display metadata that drives the color-coded grid.

export const STATUS = {
  AVAILABLE: "AVAILABLE",
  CHECKED_OUT: "CHECKED_OUT",
  DAMAGED: "DAMAGED",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

// Device type.
export const DEVICE_TYPE = {
  RADIO: "RADIO",
  SCANNER: "SCANNER",
} as const;

export type DeviceType = (typeof DEVICE_TYPE)[keyof typeof DEVICE_TYPE];

// Radios are blue tiles, scanners are amber — two colors that stay distinct
// from each other and from the status rings under warehouse lighting.
// `prefix` is the label letter new devices of that type get (R7, S12).
export const TYPE_META: Record<
  DeviceType,
  { label: string; labelEs: string; short: string; prefix: string; tile: string; badge: string; dot: string }
> = {
  RADIO: {
    label: "Radio",
    labelEs: "Radio",
    short: "RADIO",
    prefix: "R",
    tile: "bg-blue-600 text-white",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-600",
  },
  SCANNER: {
    label: "Scanner",
    labelEs: "Escáner",
    short: "SCAN",
    prefix: "S",
    tile: "bg-amber-400 text-slate-900",
    badge: "bg-amber-400 text-slate-900",
    dot: "bg-amber-400",
  },
};

export function normalizeType(type: string): DeviceType {
  return type === "SCANNER" ? "SCANNER" : "RADIO";
}

export const ROLE = {
  OPERATOR: "OPERATOR",
  // A floor supervisor: does everything an operator does, returns damaged
  // devices to service, manages the device list and kiosk logo. Cannot manage
  // employees or Teams alerts.
  SUPERVISOR: "SUPERVISOR",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

// "OVERDUE" is a derived display state (a CHECKED_OUT device past its due time),
// not a stored status. We give it its own visual key.
export type DisplayState = Status | "OVERDUE";

type StatusMeta = {
  label: string;
  // Tailwind classes for the small legend dot.
  dot: string;
  // Border color used as the status ring around tiles (dark kiosk background).
  ring: string;
  // Ring on the light management board, where a white ring would vanish.
  boardRing?: string;
};

export const STATUS_META: Record<DisplayState, StatusMeta> = {
  AVAILABLE: {
    label: "Available",
    dot: "bg-emerald-500",
    ring: "border-emerald-400",
  },
  CHECKED_OUT: {
    label: "Checked out",
    // White so the ring stays visible on both the blue and amber tiles.
    dot: "bg-white border border-slate-400",
    ring: "border-white",
    boardRing: "border-slate-900 dark:border-white",
  },
  OVERDUE: {
    label: "Overdue",
    dot: "bg-red-600",
    ring: "border-red-500",
  },
  DAMAGED: {
    label: "Damaged — needs supervisor",
    dot: "bg-fuchsia-600",
    ring: "border-fuchsia-500",
  },
  OUT_OF_SERVICE: {
    label: "Out of service",
    dot: "bg-slate-500",
    ring: "border-slate-600",
  },
};

export function boardRing(state: DisplayState): string {
  return STATUS_META[state].boardRing ?? STATUS_META[state].ring;
}

// Order the legend / summary counts follow.
export const DISPLAY_ORDER: DisplayState[] = [
  "AVAILABLE",
  "CHECKED_OUT",
  "OVERDUE",
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

export function hasRole(roles: string, role: Role): boolean {
  const parsed = parseRoles(roles);
  // Admins can perform every function.
  if (parsed.includes(ROLE.ADMIN)) return true;
  // Supervisors cover the operator role, but never admin.
  if (parsed.includes(ROLE.SUPERVISOR) && role === ROLE.OPERATOR) return true;
  return parsed.includes(role);
}

function isSupervisorOrAdmin(roles: string): boolean {
  const parsed = parseRoles(roles);
  return parsed.includes(ROLE.ADMIN) || parsed.includes(ROLE.SUPERVISOR);
}

// Who may open the fleet board and admin panel: supervisors and admins.
export function canAccessAdmin(roles: string): boolean {
  return isSupervisorOrAdmin(roles);
}

// Devices: add, edit, remove, retire/restore, and the kiosk lock.
export function canManageConfig(roles: string): boolean {
  return isSupervisorOrAdmin(roles);
}

// Employees: add, edit, deactivate, remove, bulk upload. Admin only.
export function canManageWorkers(roles: string): boolean {
  return parseRoles(roles).includes(ROLE.ADMIN);
}

// Teams notification settings. Admin only.
export function canManageTeams(roles: string): boolean {
  return parseRoles(roles).includes(ROLE.ADMIN);
}

// Kiosk logo and shift settings.
export function canManageBranding(roles: string): boolean {
  return isSupervisorOrAdmin(roles);
}

// Who may put a DAMAGED device back into service after reviewing it, and who
// may check in a device someone else has out.
export function canReturnDamaged(roles: string): boolean {
  return isSupervisorOrAdmin(roles);
}

// The capabilities a worker effectively has — admins get every function.
// Used for client-side button gating so the UI matches `hasRole`.
export function effectiveRoles(roles: string): Role[] {
  const parsed = parseRoles(roles);
  if (parsed.includes(ROLE.ADMIN)) {
    return [ROLE.OPERATOR, ROLE.SUPERVISOR, ROLE.ADMIN];
  }
  if (parsed.includes(ROLE.SUPERVISOR)) {
    return [...new Set([ROLE.OPERATOR, ...parsed])];
  }
  return parsed;
}

// Human labels for audit actions.
export const ACTION_LABEL: Record<string, string> = {
  CHECKOUT: "Checked out",
  RETURN: "Returned",
  DAMAGE: "Returned damaged",
  SUPERVISOR_RETURN: "Returned to service (supervisor)",
  RETIRE: "Retired",
  RESTORE: "Restored",
  ADD: "Added to fleet",
  EDIT: "Edited",
};

// Parse a device label like "R7", "s-12" or "7" into its canonical form.
// A bare number gets the type's prefix. Returns null when it isn't a label.
export function parseDeviceLabel(
  input: string,
  type: DeviceType
): { number: string; sortKey: number } | null {
  const m = /^\s*([A-Za-z]{0,3})\s*-?\s*(\d{1,5})\s*$/.exec(input || "");
  if (!m) return null;
  const prefix = (m[1] || TYPE_META[type].prefix).toUpperCase();
  const n = Number(m[2]);
  return { number: `${prefix}${n}`, sortKey: n };
}
