import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { getCurrentWorker } from "@/lib/session";
import { canAccessAdmin } from "@/lib/status";
import { LogoutButton } from "@/components/SessionControls";

export const metadata: Metadata = {
  title: "Safety Knife Checkout",
  description: "Check out, sanitize, and QA-inspect food-production safety knives.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const worker = await getCurrentWorker();

  return (
    <html lang="en">
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="dark:bg-slate-900 dark:text-slate-100">
        <div className="min-h-screen flex flex-col">
          <header className="bg-slate-900 text-white">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                <span aria-hidden>🔪</span>
                <span>Safety Knife Checkout</span>
              </Link>
              <div className="flex items-center gap-3 text-sm">
                <Link
                  href="/kiosk"
                  className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 hidden sm:inline"
                >
                  Kiosk
                </Link>
                {worker ? (
                  <>
                    <Link
                      href="/reports"
                      className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5"
                    >
                      Reports
                    </Link>
                    {worker && canAccessAdmin(worker.roles) && (
                      <Link
                        href="/admin"
                        className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5"
                      >
                        Admin
                      </Link>
                    )}
                    <span className="hidden md:inline text-slate-300">Signed in as</span>
                    <span className="font-medium">{worker.name}</span>
                    <LogoutButton />
                  </>
                ) : (
                  <span className="text-slate-300">Not signed in</span>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="text-center text-xs text-slate-400 py-4">
            Food-safety knife tracking · every action is logged for audit
          </footer>
        </div>
      </body>
    </html>
  );
}
