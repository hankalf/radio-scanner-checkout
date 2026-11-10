import Link from "next/link";
import { getCurrentWorker } from "@/lib/session";
import { canAccessAdmin } from "@/lib/status";
import { PinPad, LogoutButton } from "@/components/SessionControls";

export const dynamic = "force-dynamic";

// Everything except the kiosk lives under this group and is limited to admins
// and QA. Employees use the kiosk. Until an admin/QA signs in, the content is
// hidden behind a full-screen sign-in overlay.
export default async function GatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const worker = await getCurrentWorker();

  if (!worker) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 dark:text-slate-100 flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <span aria-hidden>🔪</span> Safety Knife Checkout
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Admins &amp; QA — enter your PIN to continue.
          </p>
        </div>
        <PinPad />
        <Link href="/kiosk" className="text-sky-700 underline text-sm">
          Employees: open the kiosk →
        </Link>
      </div>
    );
  }

  // Signed in, but operators/sanitation don't get the fleet or admin panel.
  if (!canAccessAdmin(worker.roles)) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 dark:text-slate-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">This area is for admins &amp; QA</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          You&apos;re signed in as {worker.name}. Employees use the kiosk to check knives
          out, in, and clean them.
        </p>
        <Link
          href="/kiosk"
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 font-semibold"
        >
          Open the kiosk
        </Link>
        <LogoutButton />
      </div>
    );
  }

  return <>{children}</>;
}
