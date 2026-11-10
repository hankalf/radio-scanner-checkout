import { getDevices } from "@/lib/data";
import { getCurrentWorker } from "@/lib/session";
import { effectiveRoles, canManageConfig } from "@/lib/status";
import DeviceBoard, { type DeviceDTO } from "@/components/DeviceBoard";
import { Legend } from "@/components/Legend";

// Always render fresh — this is a live shared board.
export const dynamic = "force-dynamic";

// The (gated) layout guarantees a signed-in worker before this renders.
export default async function DashboardPage() {
  const [devices, worker] = await Promise.all([getDevices(), getCurrentWorker()]);
  const roles = effectiveRoles(worker?.roles ?? "");

  const dto: DeviceDTO[] = devices.map((k) => ({
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
        <h1 className="text-2xl font-bold mb-1">Radios &amp; scanners</h1>
        <p className="text-slate-500 text-sm">
          Tap a device to act on it. The board refreshes automatically.
        </p>
      </div>

      <DeviceBoard
        devices={dto}
        roles={roles}
        signedIn={true}
        canConfigure={canManageConfig(worker?.roles ?? "")}
      />

      <Legend />
    </div>
  );
}
