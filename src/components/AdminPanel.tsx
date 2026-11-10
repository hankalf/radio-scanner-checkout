"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addKnife,
  addWorker,
  setWorkerActive,
  updateWorker,
  deleteWorker,
  updateTeamsSettings,
  sendTeamsTest,
  bulkAddWorkers,
  updateLogo,
  updateKnifeDetails,
  deleteKnife,
  type ActionResult,
} from "@/app/actions";
import { STATUS_META, TYPE_META, normalizeType, type DisplayState } from "@/lib/status";
import type { TeamsSettings } from "@/lib/data";

const ALL_ROLES = ["OPERATOR", "SANITATION", "QA", "MANAGER", "ADMIN"];
const TYPES = ["FC", "NFC"] as const;
const INPUT =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2";

type WorkerRow = { id: number; name: string; roles: string; active: boolean };
type KnifeRow = { id: number; number: string; type: string; status: string };
type SystemInfo = { timeZone: string; serverTime: string };

export function AdminPanel({
  canEdit,
  canManageWorkers,
  canManageTeams,
  logoDataUrl,
  knives,
  system,
  teamsSettings,
  workers,
}: {
  canEdit: boolean;
  canManageWorkers: boolean;
  canManageTeams: boolean;
  logoDataUrl: string | null;
  knives: KnifeRow[];
  system: SystemInfo;
  teamsSettings: TeamsSettings;
  workers: WorkerRow[];
}) {
  // Managers get a read-only view: the fleet list (and, below this panel, the
  // audit log). Adding knives, employees, and settings are admin/QA only.
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <Card title={`Knife fleet (${knives.length})`}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            You have <strong>view-only</strong> access as a manager. You can act on knives from
            the fleet board; ask an admin to add, edit, or remove knives.
          </p>
          <KnifeFleetSection knives={knives} readOnly />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={canManageWorkers ? "grid md:grid-cols-2 gap-6 items-start" : ""}>
        <KnivesCard knives={knives} />
        {canManageWorkers && <WorkersAndAddCard workers={workers} />}
      </div>
      <AdvancedCard
        logoDataUrl={logoDataUrl}
        system={system}
        teamsSettings={teamsSettings}
        canManageTeams={canManageTeams}
      />
    </div>
  );
}

// Knives management: add a knife and manage the whole fleet in one card.
function KnivesCard({ knives }: { knives: KnifeRow[] }) {
  return (
    <Card title="Knives">
      <AddKnifeSection />
      <div className="my-4 border-t border-slate-100 dark:border-slate-700" />
      <KnifeFleetSection knives={knives} />
    </Card>
  );
}

function KnifeFleetSection({ knives, readOnly }: { knives: KnifeRow[]; readOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Match the number (with or without a leading #), the type (FC/NFC or the
  // full label), or the status label shown on the row.
  const visible = q
    ? knives.filter((k) => {
        const type = normalizeType(k.type);
        const statusLabel = STATUS_META[k.status as DisplayState]?.label ?? k.status;
        return (
          k.number.includes(q.replace(/^#/, "")) ||
          type.toLowerCase().includes(q) ||
          TYPE_META[type].label.toLowerCase().includes(q) ||
          statusLabel.toLowerCase().includes(q)
        );
      })
    : knives;

  return (
    <div>
      {!readOnly && (
        <>
          <h3 className="font-semibold mb-1">Knife fleet ({knives.length})</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Edit a knife&apos;s number or type, or remove one added by mistake. Removing deletes
            its history — to take a real knife out of rotation, use <strong>Retire</strong> on the
            board.
          </p>
        </>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        placeholder="Search by number, type, or status…"
        aria-label="Search knives"
        className={`${INPUT} mb-2`}
      />
      {/* Tall list so most of the fleet is visible before scrolling. */}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[40rem] overflow-y-auto">
        {visible.map((k) => (
          <KnifeRowItem key={k.id} knife={k} readOnly={readOnly} />
        ))}
        {visible.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">
            No knives match &quot;{query}&quot;.
          </li>
        )}
      </ul>
    </div>
  );
}

// Advanced settings: Teams notifications, the kiosk company logo, and a
// read-only system readout (timezone that drives due dates).
function AdvancedCard({
  logoDataUrl,
  system,
  teamsSettings,
  canManageTeams,
}: {
  logoDataUrl: string | null;
  system: SystemInfo;
  teamsSettings: TeamsSettings;
  canManageTeams: boolean;
}) {
  return (
    <details className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <summary className="cursor-pointer select-none list-none p-5 flex items-center justify-between">
        <span className="text-lg font-semibold">Advanced</span>
        <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {canManageTeams ? "Teams notifications · kiosk logo · system" : "kiosk logo · system"}
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="px-5 pb-5">
        {canManageTeams && (
          <>
            <TeamsSection settings={teamsSettings} />
            <div className="my-5 border-t border-slate-100 dark:border-slate-700" />
          </>
        )}
        <LogoSection logoDataUrl={logoDataUrl} />
        <div className="my-5 border-t border-slate-100 dark:border-slate-700" />
        <SystemSection system={system} />
      </div>
    </details>
  );
}

function SystemSection({ system }: { system: SystemInfo }) {
  return (
    <div>
      <h3 className="font-semibold mb-1">System</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
        Due dates are calculated in this timezone — FC knives are due end of day, NFC knives end
        of Friday. Set the <code>TZ</code> environment variable to your plant&apos;s zone.
      </p>
      <dl className="text-sm space-y-1">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Timezone</dt>
          <dd className="font-medium tabular-nums">{system.timeZone}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500 dark:text-slate-400">Server time now</dt>
          <dd className="font-medium tabular-nums">{system.serverTime}</dd>
        </div>
      </dl>
    </div>
  );
}

function KnifeRowItem({ knife, readOnly }: { knife: KnifeRow; readOnly?: boolean }) {
  const { pending, msg, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [number, setNumber] = useState(knife.number);
  const [type, setType] = useState<"FC" | "NFC">(normalizeType(knife.type));

  function reset() {
    setNumber(knife.number);
    setType(normalizeType(knife.type));
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-3 space-y-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="numeric"
          placeholder="Knife number"
          className={INPUT}
        />
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium border ${
                type === t
                  ? `${TYPE_META[t].badge} border-transparent`
                  : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {t === "FC" ? "Food Contact" : "Non-Food Contact"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              run(() => updateKnifeDetails(knife.id, { number, type }), `Knife #${number} updated.`, () => setEditing(false))
            }
            disabled={pending}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={reset} className="rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
        <Msg msg={msg} />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">#{knife.number}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TYPE_META[normalizeType(knife.type)].badge}`}>
            {TYPE_META[normalizeType(knife.type)].short}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_META[knife.status as DisplayState]?.dot ?? "bg-slate-400"}`} />
            {STATUS_META[knife.status as DisplayState]?.label ?? knife.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {readOnly ? null : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
          >
            Edit
          </button>
          )}
          {readOnly ? null : confirmRemove ? (
            <>
              <button
                onClick={() => run(() => deleteKnife(knife.id), `Knife #${knife.number} removed.`, () => setConfirmRemove(false))}
                disabled={pending}
                className="text-sm rounded-lg px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <Msg msg={msg} />
    </li>
  );
}

function LogoSection({ logoDataUrl }: { logoDataUrl: string | null }) {
  const { pending, msg, run } = useRun();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      // Surface the same message the server would, before reading.
      run(() => Promise.resolve({ ok: false, error: "Image is too large — use one under 500 KB." }), "");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => run(() => updateLogo(String(reader.result ?? "")), "Logo updated.");
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <h3 className="font-semibold mb-1">Kiosk logo</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Shown in the top-left corner of the kiosk board. PNG, JPG, or SVG under 500&nbsp;KB.
      </p>
      <div className="flex items-center gap-4">
        <div className="h-14 w-32 shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-900 flex items-center justify-center overflow-hidden">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="Current logo" className="max-h-12 max-w-[112px] object-contain" />
          ) : (
            <span className="text-2xl" aria-hidden>🔪</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={onFile}
            disabled={pending}
            className="text-sm block"
          />
          {logoDataUrl && (
            <button
              type="button"
              onClick={() => run(() => updateLogo(""), "Logo removed.")}
              disabled={pending}
              className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function run(fn: () => Promise<ActionResult>, successText: string, onSuccess?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: successText });
        onSuccess?.();
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed." });
      }
    });
  }
  return { pending, msg, run };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-sm mt-2 ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
  );
}

function AddKnifeSection() {
  const { pending, msg, run } = useRun();
  const [number, setNumber] = useState("");
  const [type, setType] = useState<"FC" | "NFC">("FC");
  return (
    <div>
      <h3 className="font-semibold mb-1">Add a knife</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        New knives enter the fleet as Available.
      </p>
      <div className="flex gap-2 mb-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="numeric"
          placeholder="Knife number (e.g. 79)"
          className={`flex-1 ${INPUT}`}
        />
        <button
          onClick={() => run(() => addKnife(number, type), `Knife #${number} added.`)}
          disabled={pending}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <div className="flex gap-2">
        {(["FC", "NFC"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium border ${
              type === t
                ? t === "FC"
                  ? "bg-slate-300 text-slate-800 border-transparent"
                  : "bg-blue-600 text-white border-transparent"
                : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            {t === "FC" ? "Food Contact" : "Non-Food Contact"}
          </button>
        ))}
      </div>
      <Msg msg={msg} />
    </div>
  );
}

const SAMPLE_CSV =
  "name,pin,roles\n" +
  "Jane Operator,4501,OPERATOR\n" +
  "Sam Sanitation,4502,SANITATION\n" +
  "Pat Supervisor,4503,OPERATOR;SANITATION\n" +
  "Quinn QA,4504,QA\n" +
  "Alex Manager,4505,ADMIN\n";

// One admin card holding "Add a worker" and the "Employees" list.
function WorkersAndAddCard({ workers }: { workers: WorkerRow[] }) {
  return (
    <Card title="Workers">
      <AddWorkerSection />
      <div className="my-4 border-t border-slate-100 dark:border-slate-700" />
      <EmployeesSection workers={workers} />
    </Card>
  );
}

function AddWorkerSection() {
  const { pending, msg, run } = useRun();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [roles, setRoles] = useState<string[]>(["OPERATOR"]);
  const [bulkPending, startBulk] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(r: string) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      startBulk(async () => {
        const res = await bulkAddWorkers(text);
        const parts = [`${res.added} added`, `${res.skipped} skipped`];
        const text2 = parts.join(", ") + (res.errors.length ? ` — ${res.errors.slice(0, 4).join(" ")}` : "");
        setBulkMsg({ ok: res.added > 0, text: text2 });
        router.refresh();
      });
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workers-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h3 className="font-semibold mb-2">Add a worker</h3>
      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={INPUT} />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          placeholder="PIN (4–8 digits)"
          className={INPUT}
        />
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                roles.includes(r)
                  ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                  : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={() => run(() => addWorker(name, pin, roles), `${name || "Worker"} added.`)}
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 disabled:opacity-50"
        >
          Add worker
        </button>
      </div>
      <Msg msg={msg} />

      {/* Bulk upload */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="text-sm font-medium mb-1">Bulk upload (CSV)</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Columns: <code>name,pin,roles</code> (roles separated by <code>;</code> — e.g.
          <code> OPERATOR;SANITATION</code>). Duplicate PINs are skipped.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={bulkPending}
            className="text-sm"
          />
          <button
            type="button"
            onClick={downloadSample}
            className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
          >
            Download sample CSV
          </button>
        </div>
        <Msg msg={bulkMsg} />
      </div>
    </div>
  );
}

function TeamsSection({ settings }: { settings: TeamsSettings }) {
  const { pending, msg, run } = useRun();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl);
  const [notifyDamaged, setNotifyDamaged] = useState(settings.notifyDamaged);
  const [notifyOverdue, setNotifyOverdue] = useState(settings.notifyOverdue);
  const [notifyCheckout, setNotifyCheckout] = useState(settings.notifyCheckout);
  const [notifyCheckin, setNotifyCheckin] = useState(settings.notifyCheckin);
  const [notifyCleaned, setNotifyCleaned] = useState(settings.notifyCleaned);

  return (
    <div>
      <h3 className="font-semibold mb-1">Microsoft Teams notifications</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Paste a webhook URL for your Teams channel — either a <strong>Workflows</strong> webhook
        (Teams channel → ⋯ → Workflows → &quot;Post to a channel when a webhook request is
        received&quot;; URL contains <code>logic.azure.com</code>) or a legacy{" "}
        <strong>Incoming Webhook</strong> connector. Both formats are supported automatically.
        When a knife is flagged <strong>damaged</strong>, a message is posted to that channel so a
        manager can review it. Use <strong>Send test message</strong> to confirm the connection.
      </p>

      <label className="flex items-center gap-3 mb-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5" />
        <span className="font-medium">Enable Teams notifications</span>
      </label>

      <label className="block text-sm text-slate-600 dark:text-slate-300 mb-1">Webhook URL</label>
      <input
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        placeholder="https://….logic.azure.com/workflows/…  or  https://….webhook.office.com/…"
        className={`${INPUT} mb-3`}
      />

      <fieldset className="mb-4">
        <legend className="text-sm text-slate-600 dark:text-slate-300 mb-2">Notify when…</legend>
        <label className="flex items-center gap-3 mb-2">
          <input type="checkbox" checked={notifyDamaged} onChange={(e) => setNotifyDamaged(e.target.checked)} className="w-5 h-5" />
          <span>A knife is flagged damaged (needs a manager) — live</span>
        </label>
        <label className="flex items-center gap-3 mb-2">
          <input type="checkbox" checked={notifyOverdue} onChange={(e) => setNotifyOverdue(e.target.checked)} className="w-5 h-5" />
          <span>A knife goes overdue (requires a scheduled job)</span>
        </label>
        <label className="flex items-center gap-3 mb-2">
          <input type="checkbox" checked={notifyCheckout} onChange={(e) => setNotifyCheckout(e.target.checked)} className="w-5 h-5" />
          <span>A knife is checked out (with its due-back time) — live</span>
        </label>
        <label className="flex items-center gap-3 mb-2">
          <input type="checkbox" checked={notifyCheckin} onChange={(e) => setNotifyCheckin(e.target.checked)} className="w-5 h-5" />
          <span>A knife is checked in — live</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={notifyCleaned} onChange={(e) => setNotifyCleaned(e.target.checked)} className="w-5 h-5" />
          <span>A knife is cleaned &amp; returned to service — live</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Per-action alerts can be chatty on a busy floor — they are off by default.
        </p>
      </fieldset>

      <div className="flex gap-2">
        <button
          onClick={() =>
            run(
              () =>
                updateTeamsSettings({
                  enabled,
                  webhookUrl,
                  notifyDamaged,
                  notifyOverdue,
                  notifyCheckout,
                  notifyCheckin,
                  notifyCleaned,
                }),
              "Teams settings saved."
            )
          }
          disabled={pending}
          className="rounded-lg bg-slate-800 dark:bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => run(() => sendTeamsTest(), "Test message sent to Teams.")}
          disabled={pending}
          className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 disabled:opacity-50"
        >
          Send test message
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

// Group order for the employee list and export: Admin → QA → Operator → Sanitation.
const ROLE_ORDER = ["ADMIN", "QA", "OPERATOR", "SANITATION"];
function rolePriority(roles: string): number {
  const set = roles.split(",").map((r) => r.trim());
  const i = ROLE_ORDER.findIndex((r) => set.includes(r));
  return i === -1 ? ROLE_ORDER.length : i;
}

function EmployeesSection({ workers }: { workers: WorkerRow[] }) {
  const [query, setQuery] = useState("");
  const sorted = [...workers].sort(
    (a, b) => rolePriority(a.roles) - rolePriority(b.roles) || a.name.localeCompare(b.name)
  );
  const q = query.trim().toLowerCase();
  const visible = q
    ? sorted.filter(
        (w) => w.name.toLowerCase().includes(q) || w.roles.toLowerCase().includes(q)
      )
    : sorted;

  function exportCsv() {
    const rows = [
      "name,roles,active",
      ...sorted.map(
        (w) => `"${w.name.replace(/"/g, '""')}","${w.roles}",${w.active ? "yes" : "no"}`
      ),
    ];
    const blob = new Blob([rows.join("\n") + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">Employees ({workers.length})</h3>
        <button
          type="button"
          onClick={exportCsv}
          className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
        >
          Export employees (CSV)
        </button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Sorted by role: Admin, QA, Operator, Sanitation. Edit an employee&apos;s name, roles, or
        PIN; deactivate to revoke access while keeping their history; remove to delete entirely.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        placeholder="Search by name or role…"
        aria-label="Search employees"
        className={`${INPUT} mb-2`}
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
        {visible.map((w) => (
          <EmployeeRow key={w.id} worker={w} />
        ))}
        {visible.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">
            No employees match &quot;{query}&quot;.
          </li>
        )}
      </ul>
    </div>
  );
}

function EmployeeRow({ worker }: { worker: WorkerRow }) {
  const { pending, msg, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState(worker.name);
  const [roles, setRoles] = useState<string[]>(
    worker.roles.split(",").map((r) => r.trim()).filter(Boolean)
  );
  const [pin, setPin] = useState("");

  function toggle(r: string) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }
  function reset() {
    setName(worker.name);
    setRoles(worker.roles.split(",").map((r) => r.trim()).filter(Boolean));
    setPin("");
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="py-3 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Name" />
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                roles.includes(r)
                  ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                  : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          placeholder="New PIN (leave blank to keep current)"
          className={INPUT}
        />
        <div className="flex gap-2">
          <button
            onClick={() =>
              run(
                () => updateWorker(worker.id, { name, roles, pin: pin || undefined }),
                `${name} updated.`,
                () => setEditing(false)
              )
            }
            disabled={pending}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={reset} className="rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
        <Msg msg={msg} />
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className={`font-medium ${worker.active ? "" : "text-slate-400 line-through"}`}>
            {worker.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{worker.roles}</div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          <button
            onClick={() => setEditing(true)}
            className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
          >
            Edit
          </button>
          <button
            onClick={() =>
              run(
                () => setWorkerActive(worker.id, !worker.active),
                `${worker.name} ${worker.active ? "deactivated" : "reactivated"}.`
              )
            }
            disabled={pending}
            className={`text-sm rounded-lg px-3 py-1.5 disabled:opacity-50 ${
              worker.active
                ? "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {worker.active ? "Deactivate" : "Reactivate"}
          </button>
          {confirmRemove ? (
            <>
              <button
                onClick={() =>
                  run(() => deleteWorker(worker.id), `${worker.name} removed.`, () => setConfirmRemove(false))
                }
                disabled={pending}
                className="text-sm rounded-lg px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <Msg msg={msg} />
    </li>
  );
}
