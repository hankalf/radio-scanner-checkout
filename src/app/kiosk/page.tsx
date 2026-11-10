import { getDevices, getKioskLocked, getLogoDataUrl } from "@/lib/data";
import KioskBoard, { type KioskDevice } from "@/components/KioskBoard";

export const dynamic = "force-dynamic";

// Full-screen board for a wall-mounted display. Interactive unless a
// supervisor has locked it to view-only.
export default async function KioskPage() {
  const [devices, locked, logoDataUrl] = await Promise.all([
    getDevices(),
    getKioskLocked(),
    getLogoDataUrl(),
  ]);
  const dto: KioskDevice[] = devices.map((k) => ({
    id: k.id,
    number: k.number,
    status: k.status,
    type: k.type,
    dueAtMs: k.dueAt ? k.dueAt.getTime() : null,
    holderName: k.checkedOutBy?.name ?? null,
  }));
  return <KioskBoard devices={dto} locked={locked} logoDataUrl={logoDataUrl} />;
}
