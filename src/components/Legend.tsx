import { STATUS_META, DISPLAY_ORDER, TYPE_META, DEVICE_TYPE, boardRing } from "@/lib/status";

export function Legend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Legend</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 self-center">
          Status (ring around the tile):
        </span>
        {DISPLAY_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`inline-block w-3.5 h-3.5 rounded border-[3px] ${boardRing(s)}`} />
            <span>{STATUS_META[s].label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 self-center">Type (tile color):</span>
        {Object.values(DEVICE_TYPE).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className={`inline-block w-4 h-4 rounded ${TYPE_META[t].dot}`} />
            <span>{TYPE_META[t].label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Lifecycle: Available → Checked out → returned on the charger → Available. A device
        returned damaged waits for a supervisor.
      </p>
    </div>
  );
}
