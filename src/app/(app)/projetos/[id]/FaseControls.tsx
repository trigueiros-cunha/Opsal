"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { mudarFase } from "../actions";
import { FASE_LABEL, FASE_ORDEM } from "@/lib/constants";
import type { ProjetoFase } from "@/lib/types";

export function FaseControls({
  id,
  faseAtual,
}: {
  id: string;
  faseAtual: ProjetoFase;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function ir(fase: ProjetoFase) {
    if (fase === faseAtual) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("fase", fase);
    startTransition(async () => {
      await mudarFase(fd);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Fase</h3>
      <div className="flex flex-wrap items-center gap-1">
        {FASE_ORDEM.map((f, i) => (
          <div key={f} className="flex items-center">
            <button
              type="button"
              onClick={() => ir(f)}
              disabled={pending}
              className={`badge cursor-pointer border px-2.5 py-1 ${
                f === faseAtual
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {FASE_LABEL[f]}
            </button>
            {i < FASE_ORDEM.length - 1 ? (
              <span className="px-1 text-slate-300">→</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
