import Link from "next/link";
import { getCurrentWorker } from "@/lib/session";
import {
  canAccessAdmin,
  canManageConfig,
  canManageWorkers,
  canManageTeams,
  ACTION_LABEL,
} from "@/lib/status";
import { getWorkers, getRecentEvents, getTeamsSettings, getLogoDataUrl, getKnives } from "@/lib/data";
import { AdminPanel } from "@/components/AdminPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const worker = await getCurrentWorker();
  // The (gated) layout already limits this area to admins/QA and no second
  // sign-in is needed here. Keep a defensive check just in case.
  if (!worker || !canAccessAdmin(worker.roles)) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-xl font-bold mb-2">No access</h1>
        <Link href="/kiosk" className="text-sky-700 underline">
          Open the kiosk
        </Link>
      </div>
    );
  }

  const [workers, events, teamsSettings, logoDataUrl, knives] = await Promise.all([
    getWorkers(),
    getRecentEvents(50),
    getTeamsSettings(),
    getLogoDataUrl(),
    getKnives(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/" className="text-sm text-sky-700 dark:text-sky-400 underline">
            ← Back to fleet
          </Link>
        </div>
      </div>

      <AdminPanel
        canEdit={canManageConfig(worker.roles)}
        canManageWorkers={canManageWorkers(worker.roles)}
        canManageTeams={canManageTeams(worker.roles)}
        logoDataUrl={logoDataUrl}
        knives={knives.map((k) => ({ id: k.id, number: k.number, type: k.type, status: k.status }))}
        system={{
          timeZone:
            process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          serverTime: new Date().toLocaleString("en-US", {
            timeZone: process.env.TZ || undefined,
            dateStyle: "medium",
            timeStyle: "short",
          }),
        }}
        teamsSettings={teamsSettings}
        workers={workers.map((w) => ({
          id: w.id,
          name: w.name,
          roles: w.roles,
          active: w.active,
        }))}
      />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent activity (audit log)</h2>
          <a
            href="/api/export"
            className="rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-sm px-3 py-2 hover:bg-slate-700"
          >
            Export full log (CSV)
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 border-b dark:border-slate-700">
              <tr>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Knife</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">By</th>
                <th className="py-2 pr-4">Note</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b last:border-0 dark:border-slate-700">
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-medium">#{e.knife.number}</td>
                  <td className="py-2 pr-4">{ACTION_LABEL[e.action] ?? e.action}</td>
                  <td className="py-2 pr-4">{e.worker?.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{e.note ?? ""}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
