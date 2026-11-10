import { getKnives } from "@/lib/data";
import { getCurrentWorker } from "@/lib/session";
import { effectiveRoles, canManageConfig } from "@/lib/status";
import KnifeBoard, { type KnifeDTO } from "@/components/KnifeBoard";
import { Legend } from "@/components/Legend";

// Always render fresh — this is a live shared board.
export const dynamic = "force-dynamic";

// The (gated) layout guarantees a signed-in worker before this renders.
export default async function DashboardPage() {
  const [knives, worker] = await Promise.all([getKnives(), getCurrentWorker()]);
  const roles = effectiveRoles(worker?.roles ?? "");

  const dto: KnifeDTO[] = knives.map((k) => ({
    id: k.id,
    number: k.number,
    status: k.status,
    type: k.type,
    dueAtMs: k.dueAt ? k.dueAt.getTime() : null,
    checkedOutAtMs: k.checkedOutAt ? k.checkedOutAt.getTime() : null,
    holderName: k.checkedOutBy?.name ?? null,
    damageNote: k.damageNote ?? null,
    damagePhoto: k.damagePhoto ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Knife fleet</h1>
        <p className="text-slate-500 text-sm">
          Tap a knife to act on it. The board refreshes automatically.
        </p>
      </div>

      <KnifeBoard
        knives={dto}
        roles={roles}
        signedIn={true}
        canConfigure={canManageConfig(worker?.roles ?? "")}
      />

      <Legend />
    </div>
  );
}
