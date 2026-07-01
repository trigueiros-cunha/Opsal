"use client";

import { useState } from "react";
import { criarIncidencia } from "../actions";
import {
  ORIGENS,
  ORIGEM_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
} from "@/lib/constants";
import type {
  ExtracaoIncidencia,
  Origem,
  Prioridade,
  Regiao,
} from "@/lib/types";

type ApSelect = { id: string; codigo: string; regiao: Regiao };

export function NovaIncidenciaForm({
  apartamentos,
  tecnicos,
}: {
  apartamentos: ApSelect[];
  tecnicos: { id: string; nome: string }[];
}) {
  const [texto, setTexto] = useState("");
  const [aExtrair, setAExtrair] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Campos controlados (para permitir pré-preenchimento pela extração).
  const [apartamentoId, setApartamentoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [origem, setOrigem] = useState<Origem>("hospede");
  const [tecnicoId, setTecnicoId] = useState("");

  async function extrair() {
    if (!texto.trim()) return;
    setAExtrair(true);
    setAviso(null);
    try {
      const res = await fetch("/api/incidencias/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error("Falha na extração");
      const d = (await res.json()) as ExtracaoIncidencia;

      setTitulo(d.titulo);
      setDescricao(d.descricao);
      setPrioridade(d.prioridade);
      setOrigem(d.origem_sugerida);

      if (d.apartamento_reconhecido && d.apartamento_codigo) {
        const ap = apartamentos.find((a) => a.codigo === d.apartamento_codigo);
        if (ap) {
          setApartamentoId(ap.id);
          setAviso(`Apartamento reconhecido: ${ap.codigo}. Revê e confirma.`);
        } else {
          setAviso(
            `Código ${d.apartamento_codigo} detetado mas não está na lista. Escolhe à mão.`,
          );
        }
      } else {
        setAviso("Apartamento não reconhecido — escolhe à mão. Revê os campos.");
      }
    } catch {
      setAviso("Não foi possível extrair. Preenche à mão.");
    } finally {
      setAExtrair(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* Painel WhatsApp */}
      <div className="card h-fit p-4">
        <p className="text-sm font-semibold text-slate-800">Entrada WhatsApp</p>
        <p className="mt-1 text-xs text-slate-500">
          Cola a conversa. A extração sugere os campos — nada é gravado sem
          confirmares.
        </p>
        <textarea
          className="input mt-3 h-48 resize-y font-mono text-xs"
          placeholder="Cola aqui o texto da mensagem…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          onClick={extrair}
          disabled={aExtrair || !texto.trim()}
          className="btn-primary mt-3 w-full"
        >
          {aExtrair ? "A extrair…" : "Extrair campos"}
        </button>
        {aviso ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            {aviso}
          </p>
        ) : null}
      </div>

      {/* Formulário */}
      <form action={criarIncidencia} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="apartamento_id">
            Apartamento *
          </label>
          <select
            id="apartamento_id"
            name="apartamento_id"
            required
            className="input"
            value={apartamentoId}
            onChange={(e) => setApartamentoId(e.target.value)}
          >
            <option value="">— escolher —</option>
            {apartamentos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="titulo">
            Título *
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            className="input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Resumo curto do problema"
          />
        </div>

        <div>
          <label className="label" htmlFor="descricao">
            Descrição
          </label>
          <textarea
            id="descricao"
            name="descricao"
            className="input h-24 resize-y"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="prioridade">
              Prioridade
            </label>
            <select
              id="prioridade"
              name="prioridade"
              className="input"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="origem">
              Origem
            </label>
            <select
              id="origem"
              name="origem"
              className="input"
              value={origem}
              onChange={(e) => setOrigem(e.target.value as Origem)}
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
          <label className="label" htmlFor="tecnico_id">
            Técnico (opcional)
          </label>
          <select
            id="tecnico_id"
            name="tecnico_id"
            className="input"
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
          >
            <option value="">Por atribuir</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="submit" className="btn-primary">
            Criar incidência
          </button>
        </div>
      </form>
    </div>
  );
}
