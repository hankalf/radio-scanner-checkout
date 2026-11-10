"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login, logout, unlockAdmin, type ActionResult } from "@/app/actions";

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await logout(); router.refresh(); })}
      disabled={pending}
      className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 disabled:opacity-50"
    >
      Sign out
    </button>
  );
}

// Shared numeric keypad. `verify` runs the PIN against a server action.
function Keypad({
  title,
  subtitle,
  submitLabel,
  verify,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  verify: (pin: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function press(d: string) {
    setError(null);
    setPin((p) => (p.length >= 8 ? p : p + d));
  }
  function submit() {
    setError(null);
    start(async () => {
      const res = await verify(pin);
      if (res.ok) {
        setPin("");
        router.refresh();
      } else {
        setError(res.error ?? "Failed.");
        setPin("");
      }
    });
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="mx-auto max-w-xs w-full bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow p-6">
      <h2 className="text-center text-lg font-semibold mb-1">{title}</h2>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-4">{subtitle}</p>
      <div className="h-12 mb-3 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center tracking-[0.5em] text-2xl font-mono">
        {pin.replace(/./g, "•") || (
          <span className="text-slate-300 tracking-normal text-base">••••</span>
        )}
      </div>
      {error && (
        <p className="text-center text-sm text-red-600 mb-3" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xl font-semibold"
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-lg"
          aria-label="Delete"
        >
          ⌫
        </button>
        <button
          onClick={() => press("0")}
          className="h-14 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-xl font-semibold"
        >
          0
        </button>
        <button
          onClick={submit}
          disabled={pending || pin.length === 0}
          className="h-14 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

// Board sign-in.
export function PinPad() {
  return (
    <Keypad
      title="Enter your PIN"
      subtitle="Your role unlocks the actions you can take."
      submitLabel="Enter"
      verify={login}
    />
  );
}

// Admin dashboard gate — always shown before the panel.
export function AdminGatePad() {
  return (
    <Keypad
      title="Admin access"
      subtitle="Enter your admin or QA PIN to open the dashboard."
      submitLabel="Unlock"
      verify={unlockAdmin}
    />
  );
}
