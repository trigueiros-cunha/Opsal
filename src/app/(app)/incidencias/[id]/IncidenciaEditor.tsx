"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarIncidencia } from "../actions";
import { formatarTempo, maoDeObra } from "@/lib/custo";
import { formatEuro } from "@/lib/format";
import {
  ORIGENS,
  ORIGEM_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
} from "@/lib/constants";
import type { Origem, Prioridade } from "@/lib/types";

const MODOS = ["carro", "uber", "trotinete", "carrinha", "outro"];

export function IncidenciaEditor({
  id,
  titulo,
  descricao,
  apartamentoId,
  tecnicoId,
  prioridade,
  origem,
  tempoMinutos,
  deslocacaoModo,
  deslocacaoValor,
  agendadaEm,
  precoProprietario,
  notasResolucao,
  apartamentos,
  tecnicos,
}: {
  id: string;
  titulo: string;
  descricao: string | null;
  apartamentoId: string;
  tecnicoId: string | null;
  prioridade: Prioridade;
  origem: Origem;
  tempoMinutos: number | null;
  deslocacaoModo: string | null;
  deslocacaoValor: number | null;
  agendadaEm: string | null;
  precoProprietario: number | null;
  notasResolucao: string | null;
  apartamentos: { id: string; codigo: string }[];
  tecnicos: { id: string; nome: string; custo_hora: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [f, setF] = useState({
    titulo,
    descricao: descricao ?? "",
    apartamento_id: apartamentoId,
    tecnico_id: tecnicoId ?? "",
    prioridade,
    origem,
    notas: notasResolucao ?? "",
    horas: String(Math.floor((tempoMinutos ?? 0) / 60) || ""),
    minutos: String((tempoMinutos ?? 0) % 60 || ""),
    valor: deslocacaoValor != null ? String(deslocacaoValor) : "",
    agendada: agendadaEm ?? "",
    preco: precoProprietario != null ? String(precoProprietario) : "",
  });

  const modoInicial = deslocacaoModo
    ? MODOS.includes(deslocacaoModo)
      ? deslocacaoModo
      : "outro"
    : "";
  const [modo, setModo] = useState(modoInicial);
  const [modoOutro, setModoOutro] = useState(
    modoInicial === "outro" ? deslocacaoModo ?? "" : "",
  );

  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));

  const tempoMin = (Number(f.horas) || 0) * 60 + (Number(f.minutos) || 0);
  const custoHora = tecnicos.find((t) => t.id === f.tecnico_id)?.custo_hora ?? null;
  const mo = maoDeObra(tempoMin, custoHora);

  function guardar() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("titulo", f.titulo);
    fd.set("descricao", f.descricao);
    fd.set("apartamento_id", f.apartamento_id);
    fd.set("tecnico_id", f.tecnico_id);
    fd.set("prioridade", f.prioridade);
    fd.set("origem", f.origem);
    fd.set("notas_resolucao", f.notas);
    fd.set("horas", f.horas || "0");
    fd.set("minutos", f.minutos || "0");
    fd.set("deslocacao_modo", modo === "outro" ? modoOutro : modo);
    fd.set("deslocacao_valor", f.valor);
    fd.set("agendada_em", f.agendada);
    fd.set("preco_proprietario", f.preco);
    startTransition(async () => {
      await atualizarIncidencia(fd);
      router.refresh();
    });
  }

  return (
    <div className="card p-5">
      {/* ── O problema ── */}
      <h3 className="text-sm font-semibold text-slate-800">O problema</h3>
      <div className="mt-3 space-y-4">
        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={f.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Apartamento</label>
            <select
              className="input"
              value={f.apartamento_id}
              onChange={(e) => set({ apartamento_id: e.target.value })}
            >
              {apartamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Técnico</label>
            <select
              className="input"
              value={f.tecnico_id}
              onChange={(e) => set({ tecnico_id: e.target.value })}
            >
              <option value="">Por atribuir</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Agendada para</label>
            <input
              type="date"
              className="input"
              value={f.agendada}
              onChange={(e) => set({ agendada: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Prioridade</label>
            <select
              className="input"
              value={f.prioridade}
              onChange={(e) => set({ prioridade: e.target.value as Prioridade })}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Origem</label>
            <select
              className="input"
              value={f.origem}
              onChange={(e) => set({ origem: e.target.value as Origem })}
            >
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {ORIGEM_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea
            className="input h-24 resize-y"
            value={f.descricao}
            onChange={(e) => set({ descricao: e.target.value })}
          />
        </div>
      </div>

      {/* ── Resolução ── */}
      <div className="my-5 border-t border-slate-100" />
      <h3 className="text-sm font-semibold text-slate-800">Resolução</h3>
      <div className="mt-3 space-y-4">
        <div>
          <label className="label">O que foi feito</label>
          <textarea
            className="input h-24 resize-y"
            value={f.notas}
            onChange={(e) => set({ notas: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Tempo de trabalho</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              className="input w-20"
              value={f.horas}
              onChange={(e) => set({ horas: e.target.value })}
            />
            <span className="text-sm text-slate-500">h</span>
            <input
              type="number"
              min="0"
              max="59"
              className="input w-20"
              value={f.minutos}
              onChange={(e) => set({ minutos: e.target.value })}
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

        <div className="grid grid-cols-2 gap-4">
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
              value={f.valor}
              onChange={(e) => set({ valor: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Preço ao proprietário (€)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={f.preco}
              onChange={(e) => set({ preco: e.target.value })}
              placeholder="receita cobrada"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={guardar} disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
