"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mudarEstado } from "../actions";
import { ESTADOS, ESTADO_LABEL } from "@/lib/constants";
import type { IncidenciaEstado } from "@/lib/types";

export function EstadoControls({
  id,
  estadoAtual,
  bloqueadaAguarda,
  temRecorrente,
}: {
  id: string;
  estadoAtual: IncidenciaEstado;
  bloqueadaAguarda: string | null;
  temRecorrente: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [alvo, setAlvo] = useState<IncidenciaEstado>(estadoAtual);
  const [aguarda, setAguarda] = useState(bloqueadaAguarda ?? "");
  const [nota, setNota] = useState("");

  function aplicar() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("estado", alvo);
    if (alvo === "bloqueada") fd.set("bloqueada_aguarda", aguarda);
    if ((alvo === "resolvida" || alvo === "fechada") && nota.trim())
      fd.set("notas_resolucao", nota);
    startTransition(async () => {
      await mudarEstado(fd);
      router.refresh();
    });
  }

  const fechaCiclo =
    temRecorrente && (alvo === "resolvida" || alvo === "fechada");

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Estado</h3>
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setAlvo(e)}
            className={`badge cursor-pointer border px-2.5 py-1 ${
              alvo === e
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      {alvo === "bloqueada" ? (
        <div className="mt-3">
          <label className="label">A aguardar (motivo do bloqueio)</label>
          <input
            className="input"
            value={aguarda}
            onChange={(e) => setAguarda(e.target.value)}
            placeholder="ex.: peça encomendada, resposta do proprietário…"
          />
        </div>
      ) : null}

      {alvo === "resolvida" || alvo === "fechada" ? (
        <div className="mt-3">
          <label className="label">Notas de resolução (opcional)</label>
          <textarea
            className="input h-20 resize-y"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          {fechaCiclo ? (
            <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
              Esta incidência veio de uma recorrente — ao resolver, o ciclo
              fecha e a próxima data recalcula-se (semáforo volta a verde).
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={aplicar}
        disabled={pending || alvo === estadoAtual}
        className="btn-primary mt-4 w-full"
      >
        {pending ? "A guardar…" : "Aplicar estado"}
      </button>
    </div>
  );
}
