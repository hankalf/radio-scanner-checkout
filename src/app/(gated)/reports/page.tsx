import Link from "next/link";
import { getCurrentWorker } from "@/lib/session";
import { getCheckedOutReport, getMetrics, formatDuration } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const worker = await getCurrentWorker();
  if (!worker) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-xl font-bold mb-2">Reports</h1>
        <p className="text-slate-500 mb-4">Sign in with your PIN to view reports.</p>
        <Link href="/" className="text-sky-700 underline">
          ← Back to fleet
        </Link>
      </div>
    );
  }

  const [sweep, metrics] = await Promise.all([getCheckedOutReport(), getMetrics()]);
  const outstanding = sweep.length;
  const overdueCount = sweep.filter((s) => s.overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Link href="/" className="text-sm text-sky-700 underline">
          ← Back to fleet
        </Link>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Still checked out" value={String(outstanding)} accent={overdueCount > 0 ? "text-red-600" : undefined} sub={overdueCount > 0 ? `${overdueCount} overdue` : "none overdue"} />
        <MetricCard label="Total checkouts" value={String(metrics.totalCheckouts)} sub="all time" />
        <MetricCard
          label="Avg turnaround"
          value={formatDuration(metrics.avgTurnaroundMs)}
          sub={`${metrics.cyclesMeasured} cleaning cycle${metrics.cyclesMeasured === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Cleanings"
          value={String(metrics.cleans)}
          sub="all time"
        />
      </div>

      {/* End-of-day sweep */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold mb-1">End-of-day sweep</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Knives still checked out right now — chase these down before shift close.
        </p>
        {sweep.length === 0 ? (
          <p className="text-emerald-600 text-sm">✓ All knives are accounted for.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400 border-b dark:border-slate-700">
                <tr>
                  <th className="py-2 pr-4">Knife</th>
                  <th className="py-2 pr-4">Held by</th>
                  <th className="py-2 pr-4">Since</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {sweep.map((s) => (
                  <tr key={s.number} className="border-b last:border-0 dark:border-slate-700">
                    <td className="py-2 pr-4 font-medium">#{s.number}</td>
                    <td className="py-2 pr-4">{s.holder}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {s.checkedOutAt?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {s.dueAt?.toLocaleString() ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {s.overdue ? (
                        <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 text-xs font-medium">
                          Overdue
                        </span>
                      ) : (
                        <span className="rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 text-xs font-medium">
                          On time
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Most-used knives */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold mb-1">Most-used knives</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          High counts can flag blades that see the heaviest wear.
        </p>
        {metrics.mostUsed.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">No checkouts recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {metrics.mostUsed.map((m) => {
              const max = metrics.mostUsed[0].count || 1;
              return (
                <li key={m.number} className="flex items-center gap-3">
                  <span className="w-12 font-medium">#{m.number}</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-sky-500 h-3 rounded-full"
                      style={{ width: `${(m.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                    {m.count} use{m.count === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? "text-slate-900 dark:text-slate-100"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
