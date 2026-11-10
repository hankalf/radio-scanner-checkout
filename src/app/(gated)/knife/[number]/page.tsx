import Link from "next/link";
import { notFound } from "next/navigation";
import { getKnifeByNumber } from "@/lib/data";
import { STATUS_META, ACTION_LABEL, displayState, TYPE_META, normalizeType } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function KnifeDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const knife = await getKnifeByNumber(number);
  if (!knife) notFound();

  const state = displayState(knife.status, knife.dueAt);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-sky-700 underline">
        ← Back to fleet
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Knife #{knife.number}
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold ${TYPE_META[normalizeType(knife.type)].badge}`}
            >
              {TYPE_META[normalizeType(knife.type)].short}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded-full ${STATUS_META[state].dot}`} />
            <span className="font-medium">{STATUS_META[state].label}</span>
          </div>
        </div>
        {knife.checkedOutBy && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Currently held by {knife.checkedOutBy.name}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold mb-3">Lifecycle history</h2>
        {knife.events.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">No events yet.</p>
        ) : (
          <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-4">
            {knife.events.map((e) => (
              <li key={e.id} className="ml-4">
                <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-slate-400" />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </span>
                  <span className="text-xs text-slate-400">
                    {e.createdAt.toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  by {e.worker?.name ?? "—"}
                  {e.fromStatus && (
                    <span className="text-slate-400">
                      {" "}
                      · {e.fromStatus} → {e.toStatus}
                    </span>
                  )}
                </div>
                {e.note && (
                  <div className="text-sm text-slate-500 italic mt-0.5">“{e.note}”</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
