import { getKnives, getKioskLocked, getLogoDataUrl } from "@/lib/data";
import KioskBoard, { type KioskKnife } from "@/components/KioskBoard";

export const dynamic = "force-dynamic";

// Full-screen board for a wall-mounted display. Interactive unless a
// supervisor has locked it to view-only.
export default async function KioskPage() {
  const [knives, locked, logoDataUrl] = await Promise.all([
    getKnives(),
    getKioskLocked(),
    getLogoDataUrl(),
  ]);
  const dto: KioskKnife[] = knives.map((k) => ({
    id: k.id,
    number: k.number,
    status: k.status,
    type: k.type,
    dueAtMs: k.dueAt ? k.dueAt.getTime() : null,
    holderName: k.checkedOutBy?.name ?? null,
  }));
  return <KioskBoard knives={dto} locked={locked} logoDataUrl={logoDataUrl} />;
}
