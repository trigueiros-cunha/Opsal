"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { analisarImport, importarLote } from "./actions";
import type { ResultadoAnalise } from "@/lib/import/tipos";

const LOTE = 15;
type Fase = "inicio" | "analisar" | "previsao" | "importar" | "fim";

export function ImportWizard() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<ResultadoAnalise | null>(null);
  const [pct, setPct] = useState(0);
  const [inseridas, setInseridas] = useState(0);

  async function onFicheiro(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    setFase("analisar");
    try {
      const fd = new FormData();
      fd.append("file", file);
      setAnalise(await analisarImport(fd));
      setFase("previsao");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha a ler o ficheiro.");
      setFase("inicio");
    }
  }

  async function confirmar() {
    if (!analise) return;
    setFase("importar");
    setPct(0);
    setInseridas(0);
    try {
      const novas = analise.novas;
      let feitas = 0;
      let total = 0;
      for (let i = 0; i < novas.length; i += LOTE) {
        const r = await importarLote(novas.slice(i, i + LOTE));
        total += r.inseridas;
        feitas += Math.min(LOTE, novas.length - i);
        setPct(Math.round((feitas / Math.max(novas.length, 1)) * 100));
        setInseridas(total);
      }
      setFase("fim");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha a importar.");
      setFase("previsao");
    }
  }

  return (
    <div className="space-y-5">
      {erro ? (
        <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      {(fase === "inicio" || fase === "analisar") && (
        <div className="card p-6">
          <label className="label">Ficheiro Excel (.xlsx ou .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFicheiro}
            disabled={fase === "analisar"}
            className="block text-sm"
          />
          {fase === "analisar" ? (
            <p className="mt-3 text-sm text-slate-500">A analisar o ficheiro…</p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Colunas esperadas: DATA, CASA, PROBLEMA, RESOLVIDO (e opcionais
              RESP., OBSERVAÇÕES FO/HM/HSK, Link).
            </p>
          )}
        </div>
      )}

      {fase === "previsao" && analise && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">
                {analise.novas.length}
              </p>
              <p className="text-xs text-slate-500">Novas (vão entrar)</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">{analise.existem}</p>
              <p className="text-xs text-slate-500">Já existem (ignoradas)</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">
                {analise.erros.length}
              </p>
              <p className="text-xs text-slate-500">Com erro (não entram)</p>
            </div>
          </div>

          {analise.erros.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Linhas com erro — corrige no Excel e reimporta
              </div>
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th w-16">Linha</th>
                    <th className="th w-56">Motivo</th>
                    <th className="th">Problema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analise.erros.map((e, i) => (
                    <tr key={i}>
                      <td className="td">{e.linha}</td>
                      <td className="td text-red-600">{e.motivo}</td>
                      <td className="td text-slate-600">{e.problema}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analise.novas.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pré-visualização das novas (título afinado pela IA na importação)
              </div>
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th w-24">Casa</th>
                    <th className="th w-28">Data</th>
                    <th className="th w-24">Estado</th>
                    <th className="th">Título (provisório)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analise.novas.slice(0, 50).map((c) => (
                    <tr key={c.import_ref}>
                      <td className="td font-mono text-xs">
                        {c.apartamento_codigo}
                      </td>
                      <td className="td text-slate-600">{c.aberta_em}</td>
                      <td className="td">
                        <span className="badge border-slate-200 bg-slate-50 text-slate-600">
                          {c.estado}
                        </span>
                      </td>
                      <td className="td text-slate-700">{c.titulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analise.novas.length > 50 && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  … e mais {analise.novas.length - 50}.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              className="btn-primary"
              disabled={analise.novas.length === 0}
              onClick={confirmar}
            >
              Importar {analise.novas.length} novas
            </button>
            <button className="btn-secondary" onClick={() => setFase("inicio")}>
              Escolher outro ficheiro
            </button>
          </div>
        </>
      )}

      {fase === "importar" && (
        <div className="card p-6">
          <p className="mb-3 text-sm text-slate-700">
            A importar… {inseridas} inseridas
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {fase === "fim" && (
        <div className="card p-6">
          <p className="text-sm text-slate-700">
            ✓ Importação concluída — {inseridas} incidências inseridas.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/incidencias" className="btn-primary">
              Ver incidências
            </Link>
            <button className="btn-secondary" onClick={() => setFase("inicio")}>
              Importar outro ficheiro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
