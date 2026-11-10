"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_META,
  DISPLAY_ORDER,
  TYPE_META,
  normalizeType,
  type DisplayState,
} from "@/lib/status";
import { kioskCheckout, kioskReturn, kioskIdentify, type ReturnAnswers } from "@/app/actions";
import { ReturnChecklist } from "./ReturnChecklist";

export type KioskDevice = {
  id: number;
  number: string;
  status: string;
  type: string;
  dueAtMs: number | null;
  holderName: string | null;
};

function stateOf(k: KioskDevice, now: number): DisplayState {
  if (k.status === "CHECKED_OUT" && k.dueAtMs && k.dueAtMs < now) return "OVERDUE";
  return k.status as DisplayState;
}

// Kiosk tiles are filled by device TYPE (blue radios, amber scanners); status
// is shown by the colored ring around the tile.
const COLUMNS = 10;

// Compact holder label for the small kiosk tile: "First L." Parentheticals
// (e.g. a seeded "Olivia (Operator)") are stripped first.
function shortName(full: string): string {
  const parts = full.replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return full.trim();
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Compact due label for the tile: same-day shows just the time, another day
// shows the weekday too. An overdue device says so outright.
function dueLabel(dueAtMs: number, now: number): string {
  if (dueAtMs < now) return "OVERDUE";
  const due = new Date(dueAtMs);
  const sameDay = new Date(now).toDateString() === due.toDateString();
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay
    ? `Due ${time}`
    : `Due ${due.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

type KioskAction = "CHECKOUT" | "RETURN";

function kioskActionFor(status: string): { action: KioskAction; label: string } | null {
  switch (status) {
    case "AVAILABLE":
      return { action: "CHECKOUT", label: "Check out · Sacar" };
    case "CHECKED_OUT":
      return { action: "RETURN", label: "Check in (return) · Devolver" };
    default:
      return null; // DAMAGED / OUT_OF_SERVICE → supervisors handle on the fleet board
  }
}

export default function KioskBoard({
  devices,
  locked,
  logoDataUrl,
}: {
  devices: KioskDevice[];
  locked: boolean;
  logoDataUrl?: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const withState = useMemo(
    () => devices.map((k) => ({ k, state: stateOf(k, now || Date.now()) })),
    [devices, now]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { state } of withState) c[state] = (c[state] ?? 0) + 1;
    return c;
  }, [withState]);

  const overdue = withState.filter((x) => x.state === "OVERDUE").map((x) => x.k.number);
  const selected = devices.find((k) => k.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-3 lg:p-4 overflow-hidden">
      {/* Compact top bar: title + counts + legend on one row so the grid gets
          the rest of the (landscape) screen height. */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1 mb-2">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              alt="Company logo"
              className="h-8 lg:h-9 w-auto max-w-[160px] object-contain rounded bg-white/5 p-0.5"
            />
          ) : (
            <span aria-hidden>📻</span>
          )}
          Radio &amp; Scanner Check-in / Checkout
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
          {DISPLAY_ORDER.map((s) => (
            <div
              key={s}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs lg:text-sm"
            >
              <span className={`inline-block w-3 h-3 rounded-full ${STATUS_META[s].dot}`} />
              <span className="text-slate-300">{STATUS_META[s].label}</span>
              <span className="text-base lg:text-lg font-bold tabular-nums">{counts[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {locked ? (
        <p className="text-amber-300 text-xs lg:text-sm mb-1">
          🔒 View-only — the kiosk is locked. · Solo lectura — el kiosco está bloqueado.
        </p>
      ) : (
        <p className="text-slate-400 text-xs lg:text-sm mb-1">
          Tap a radio or scanner, enter your PIN, and confirm your name. · Toque un radio o escáner,
          ingrese su PIN y confirme su nombre.
        </p>
      )}

      {/* Return policy + type key */}
      <p className="text-xs lg:text-sm mb-2 flex flex-wrap items-center gap-x-5 gap-y-0.5">
        <span>
          <span className="font-semibold text-slate-200">Return by end of your shift, on the charger</span>{" "}
          <span className="text-slate-500">· devolver al final de su turno, en el cargador</span>
        </span>
        {(["RADIO", "SCANNER"] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-3.5 h-3.5 rounded ${TYPE_META[t].dot}`} />
            <span className="text-slate-300">
              {TYPE_META[t].label}
              {TYPE_META[t].labelEs !== TYPE_META[t].label && ` · ${TYPE_META[t].labelEs}`}
            </span>
          </span>
        ))}
      </p>

      {overdue.length > 0 && (
        <div className="mb-2 rounded-lg bg-red-950 border border-red-700 px-3 py-2 text-red-200 text-base lg:text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>⚠️</span>
          {overdue.length} OVERDUE / VENCIDO — {overdue.join("  ")}
        </div>
      )}

      {/* Grid — 10 columns; radios fill the top rows and scanners start on a
          fresh row below them (20 + 20 → 4 rows). Rows share the remaining
          height so the whole board fits a landscape iPad with no scrolling.
          Text scales with vmin so it tracks the tile size. */}
      <div className="flex-1 min-h-0">
        <div
          className="grid gap-1.5 lg:gap-2 h-full w-full"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
        >
          {withState.map(({ k, state }, i) => (
            <button
              key={k.id}
              onClick={() => !locked && setSelectedId(k.id)}
              className={`relative min-h-0 rounded-lg lg:rounded-xl border-[3px] lg:border-4 flex flex-col items-center justify-center gap-0.5 font-bold transition ${
                TYPE_META[normalizeType(k.type)].tile
              } ${STATUS_META[state].ring} ${state === "OUT_OF_SERVICE" ? "opacity-40" : ""} ${locked ? "cursor-default" : ""}`}
              // Start each device type on a new row.
              style={i > 0 && withState[i - 1].k.type !== k.type ? { gridColumnStart: 1 } : undefined}
              title={`${k.number} — ${STATUS_META[state].label} · ${TYPE_META[normalizeType(k.type)].label}`}
            >
              {/* who has it checked out — pinned to the top of the card */}
              {k.status === "CHECKED_OUT" && k.holderName && (
                <span
                  className="absolute inset-x-0 top-0 truncate rounded-t px-1 py-0.5 text-center font-semibold bg-black/25 leading-tight"
                  style={{ fontSize: "clamp(0.45rem, 1.5vmin, 0.85rem)" }}
                >
                  {shortName(k.holderName)}
                </span>
              )}
              {/* vmin tracks the viewport, not the tile, so keep the size
                  conservative: a 4-char label (R020) must fit a 1/10-width
                  column on the smallest iPad. */}
              <span className="max-w-full leading-none font-extrabold" style={{ fontSize: "clamp(0.9rem, 3.5vmin, 2.5rem)" }}>
                {k.number}
              </span>
              {/* when it's due back */}
              {k.dueAtMs && (k.status === "CHECKED_OUT" || state === "OVERDUE") && (
                <span
                  className={`w-full px-0.5 text-center leading-tight ${
                    state === "OVERDUE"
                      ? "font-extrabold text-red-100 bg-red-700/80 rounded"
                      : "font-semibold"
                  }`}
                  style={{ fontSize: "clamp(0.42rem, 1.45vmin, 0.8rem)" }}
                >
                  {dueLabel(k.dueAtMs, now || Date.now())}
                </span>
              )}
              {/* device type — pinned to the bottom of the card */}
              <span
                className="absolute inset-x-0 bottom-0 px-0.5 py-0.5 text-center font-bold uppercase tracking-tight leading-[1.05]"
                style={{ fontSize: "clamp(0.5rem, 1.7vmin, 1rem)" }}
              >
                {TYPE_META[normalizeType(k.type)].label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && !locked && (
        <KioskModal
          device={selected}
          state={stateOf(selected, now || Date.now())}
          onClose={() => setSelectedId(null)}
          onDone={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function KioskModal({
  device,
  state,
  onClose,
  onDone,
}: {
  device: KioskDevice;
  state: DisplayState;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"pin" | "confirm" | "checklist">("pin");
  const [pin, setPin] = useState("");
  const [workerName, setWorkerName] = useState<string | null>(null);
  const [dueAtMs, setDueAtMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = kioskActionFor(device.status);

  function identify() {
    if (!act) return;
    setError(null);
    start(async () => {
      const res = await kioskIdentify(device.id, act.action, pin);
      if (res.ok) {
        setWorkerName(res.name);
        setDueAtMs(res.dueAtMs ?? null);
        setStep("confirm");
      } else {
        setError(res.error);
        setPin("");
      }
    });
  }

  // Confirm "it's me": a return goes to the checklist; checkout runs immediately.
  function afterConfirm() {
    if (!act) return;
    if (act.action === "RETURN") {
      setStep("checklist");
      return;
    }
    setError(null);
    start(async () => {
      const res = await kioskCheckout(device.id, pin);
      if (res.ok) onDone();
      else {
        setError(res.error ?? "Action failed.");
        setStep("pin");
        setPin("");
      }
    });
  }

  function submitReturn(answers: ReturnAnswers) {
    setError(null);
    start(async () => {
      const res = await kioskReturn(device.id, pin, answers);
      if (res.ok) onDone();
      else setError(res.error ?? "Action failed.");
    });
  }

  function notMe() {
    setStep("pin");
    setPin("");
    setWorkerName(null);
    setError(null);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 w-full max-w-sm rounded-2xl shadow-xl p-6 max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">{TYPE_META[normalizeType(device.type)].label} {device.number}</h2>
          <button onClick={onClose} className="text-slate-400 text-3xl leading-none px-2">
            ×
          </button>
        </div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`inline-block w-3 h-3 rounded-full ${STATUS_META[state].dot}`} />
          <span className="font-medium">{STATUS_META[state].label}</span>
        </div>

        {!act ? (
          <p className="text-slate-600">
            {device.status === "DAMAGED"
              ? "This device is damaged — a supervisor will review it. · Este equipo está dañado — un supervisor lo revisará."
              : "No action for this device — it's out of service. · Sin acción — fuera de servicio."}
          </p>
        ) : step === "pin" ? (
          <>
            <div className="rounded-lg bg-slate-100 px-4 py-3 mb-4 text-center">
              <div className="text-lg font-semibold">{act.label}</div>
              <div className="text-xs text-slate-500">Enter your PIN · Ingrese su PIN</div>
            </div>
            <div className="h-12 mb-3 rounded-lg border border-slate-300 flex items-center justify-center tracking-[0.5em] text-2xl font-mono">
              {pin.replace(/./g, "•") || (
                <span className="text-slate-300 tracking-normal text-base">enter PIN</span>
              )}
            </div>
            {error && <p className="text-center text-sm text-red-600 mb-3" role="alert">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              {keys.map((d) => (
                <button
                  key={d}
                  onClick={() => { setError(null); setPin((p) => (p.length >= 8 ? p : p + d)); }}
                  className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 text-xl font-semibold"
                >
                  {d}
                </button>
              ))}
              <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 text-lg" aria-label="Delete">⌫</button>
              <button onClick={() => { setError(null); setPin((p) => (p.length >= 8 ? p : p + "0")); }} className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 text-xl font-semibold">0</button>
              <button
                onClick={identify}
                disabled={pending || pin.length === 0}
                className="h-14 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
              >
                {pending ? "…" : "Next / Siguiente"}
              </button>
            </div>
          </>
        ) : step === "confirm" ? (
          <>
            <div className="rounded-lg bg-slate-100 px-4 py-4 mb-4 text-center">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Verify it&apos;s you · Verifique que es usted
              </div>
              <div className="text-2xl font-bold">{workerName}</div>
              <div className="text-sm text-slate-600 mt-2">{act.label} — {device.number}</div>
            </div>
            {act.action === "CHECKOUT" && dueAtMs && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4 text-center text-amber-900">
                <div className="text-xs uppercase tracking-wide font-semibold mb-0.5">
                  Due back · Fecha de devolución
                </div>
                <div className="text-lg font-bold">
                  {new Date(dueAtMs).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            )}
            {error && <p className="text-center text-sm text-red-600 mb-3" role="alert">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={notMe} disabled={pending} className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold disabled:opacity-50">
                Not me · No soy yo
              </button>
              <button onClick={afterConfirm} disabled={pending} className="h-14 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50">
                {pending ? "…" : act.action === "RETURN" ? "Yes — continue / Sí" : "Yes, that's me / Sí"}
              </button>
            </div>
          </>
        ) : (
          <ReturnChecklist name={workerName} pending={pending} error={error} onCancel={notMe} onSubmit={submitReturn} />
        )}
      </div>
    </div>
  );
}
