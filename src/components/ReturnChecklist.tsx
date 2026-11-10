"use client";

import { useState } from "react";
import type { ReturnAnswers } from "@/app/actions";

// Downscale a captured photo to a small JPEG data URL so it fits in the DB
// column without needing object storage. Camera shots are multi-MB; this caps
// the longest edge and re-encodes as JPEG.
async function downscalePhoto(file: File, maxDim = 1024, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// Return checklist (bilingual), shared by the kiosk and the fleet board.
// The device must be on its charger; a damaged one needs a reason and is held
// for a supervisor.
export function ReturnChecklist({
  name,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  name: string | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (a: ReturnAnswers) => void;
}) {
  const [onCharger, setOnCharger] = useState<boolean | null>(null);
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED" | null>(null);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhoto(await downscalePhoto(file));
    } catch {
      setPhoto(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  const ready =
    onCharger === true &&
    condition !== null &&
    (condition !== "DAMAGED" || reason.trim().length > 0);

  const choice = (active: boolean, color: string) =>
    `rounded-lg py-2 text-sm font-semibold border ${
      active ? `${color} text-white border-transparent` : "bg-white text-slate-900 border-slate-300"
    }`;

  return (
    <div className="space-y-4">
      {name && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Check-in by <span className="font-semibold">{name}</span> · Devolución por
        </div>
      )}

      <div>
        <div className="text-sm font-medium mb-1">
          1. Placed on the charger? · ¿Lo puso en el cargador?
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setOnCharger(true)} className={choice(onCharger === true, "bg-emerald-600")}>
            Yes / Sí
          </button>
          <button onClick={() => setOnCharger(false)} className={choice(onCharger === false, "bg-red-600")}>
            No
          </button>
        </div>
        {onCharger === false && (
          <p className="text-xs text-red-600 mt-1">
            Put it on the charger first, then answer Yes. · Póngalo en el cargador primero.
          </p>
        )}
      </div>

      <div>
        <div className="text-sm font-medium mb-1">2. Condition · Condición</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setCondition("GOOD")} className={choice(condition === "GOOD", "bg-emerald-600")}>
            Good / Bueno
          </button>
          <button onClick={() => setCondition("DAMAGED")} className={choice(condition === "DAMAGED", "bg-fuchsia-600")}>
            Damaged / Dañado
          </button>
        </div>
      </div>

      {condition === "DAMAGED" && (
        <div>
          <div className="text-sm font-medium mb-1">
            3. What is wrong with it? · ¿Qué tiene?
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Describe the damage… · Describa el daño…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />

          {/* Optional photo of the damage. */}
          <div className="mt-2">
            <div className="text-sm font-medium mb-1">Photo (optional) · Foto (opcional)</div>
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Damage" className="h-16 w-16 rounded object-cover border border-slate-300" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="text-sm rounded-lg px-3 py-1.5 bg-slate-100 text-slate-900 hover:bg-slate-200"
                >
                  Remove · Quitar
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-slate-100 text-slate-900 hover:bg-slate-200 cursor-pointer">
                {photoBusy ? "…" : "📷 Add photo · Agregar foto"}
                <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
              </label>
            )}
          </div>

          <p className="text-xs text-fuchsia-700 mt-2">
            A supervisor must return this device to service. · Un supervisor debe devolverlo al servicio.
          </p>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-600" role="alert">{error}</p>}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onCancel} disabled={pending} className="h-12 rounded-lg bg-slate-100 text-slate-900 hover:bg-slate-200 font-semibold disabled:opacity-50">
          Cancel · Cancelar
        </button>
        <button
          onClick={() =>
            onSubmit({
              onCharger: onCharger === true,
              condition: condition ?? "GOOD",
              damageReason: reason,
              damagePhoto: photo ?? undefined,
            })
          }
          disabled={pending || !ready || photoBusy}
          className="h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
        >
          {pending ? "…" : "Submit · Enviar"}
        </button>
      </div>
    </div>
  );
}
