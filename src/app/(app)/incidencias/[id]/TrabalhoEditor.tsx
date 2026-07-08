"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarTrabalho } from "../actions";
import { formatarTempo, maoDeObra } from "@/lib/custo";
import { formatEuro } from "@/lib/format";

const MODOS = ["carro", "uber", "trotinete", "carrinha", "outro"];

export function TrabalhoEditor({
  id,
  tempoMinutos,
  deslocacaoModo,
  deslocacaoValor,
  notasResolucao,
  custoHora,
}: {
  id: string;
  tempoMinutos: number | null;
  deslocacaoModo: string | null;
  deslocacaoValor: number | null;
  notasResolucao: string | null;
  custoHora: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const modoInicial = deslocacaoModo
    ? MODOS.includes(deslocacaoModo)
      ? deslocacaoModo
      : "outro"
    : "";
  const [horas, setHoras] = useState(
    String(Math.floor((tempoMinutos ?? 0) / 60) || ""),
  );
  const [minutos, setMinutos] = useState(String((tempoMinutos ?? 0) % 60 || ""));
  const [modo, setModo] = useState(modoInicial);
  const [modoOutro, setModoOutro] = useState(
    modoInicial === "outro" ? deslocacaoModo ?? "" : "",
  );
  const [valor, setValor] = useState(
    deslocacaoValor != null ? String(deslocacaoValor) : "",
  );
  const [notas, setNotas] = useState(notasResolucao ?? "");

  const tempoMin = (Number(horas) || 0) * 60 + (Number(minutos) || 0);
  const mo = maoDeObra(tempoMin, custoHora);

  function guardar() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("horas", horas || "0");
    fd.set("minutos", minutos || "0");
    fd.set("deslocacao_modo", modo === "outro" ? modoOutro : modo);
    fd.set("deslocacao_valor", valor);
    fd.set("notas_resolucao", notas);
    startTransition(async () => {
      await guardarTrabalho(fd);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Trabalho &amp; deslocação
      </h3>

      <div className="space-y-4">
        <div>
          <label className="label">Tempo de trabalho</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              className="input w-20"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
            />
            <span className="text-sm text-slate-500">h</span>
            <input
              type="number"
              min="0"
              max="59"
              className="input w-20"
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
            />
            <span className="text-sm text-slate-500">min</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {tempoMin > 0
              ? mo != null
                ? `${formatarTempo(tempoMin)} · mão de obra ${formatEuro(mo)}`
                : `${formatarTempo(tempoMin)} · sem técnico — sem valor`
              : "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Deslocação</label>
            <select
              className="input"
              value={modo}
              onChange={(e) => setModo(e.target.value)}
            >
              <option value="">—</option>
              {MODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {modo === "outro" ? (
              <input
                className="input mt-2"
                placeholder="Qual?"
                value={modoOutro}
                onChange={(e) => setModoOutro(e.target.value)}
              />
            ) : null}
          </div>
          <div>
            <label className="label">Valor deslocação (€)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">O que foi feito</label>
          <textarea
            className="input h-24 resize-y"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={guardar} disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
