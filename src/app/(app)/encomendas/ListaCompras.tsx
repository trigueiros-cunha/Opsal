"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarItemLista,
  removerItemLista,
  criarEncomendaDeItens,
} from "./actions";
import { ENCOMENDA_DESTINOS, ENCOMENDA_DESTINO_LABEL } from "@/lib/constants";
import type { EncomendaDestino, ListaCompraItem } from "@/lib/types";

type ApSelect = { id: string; codigo: string };

export function ListaCompras({
  itens,
  apartamentos,
}: {
  itens: ListaCompraItem[];
  apartamentos: ApSelect[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [descricao, setDescricao] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [aConverter, setAConverter] = useState(false);
  const [destino, setDestino] = useState<EncomendaDestino>("consumo");
  const [apartamentoId, setApartamentoId] = useState("");

  const selecionados = itens.filter((i) => sel[i.id]).map((i) => i.id);

  function adicionar() {
    if (!descricao.trim()) return;
    const fd = new FormData();
    fd.set("descricao", descricao);
    startTransition(async () => {
      await adicionarItemLista(fd);
      setDescricao("");
      router.refresh();
    });
  }

  function remover(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await removerItemLista(fd);
      router.refresh();
    });
  }

  function converter() {
    if (selecionados.length === 0) return;
    const fd = new FormData();
    for (const id of selecionados) fd.append("itemIds", id);
    fd.set("destino", destino);
    if (destino === "proprietario") fd.set("apartamento_id", apartamentoId);
    startTransition(async () => {
      await criarEncomendaDeItens(fd); // redireciona para o detalhe
    });
  }

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        Lista de compras
      </h2>

      {/* Captura rápida */}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="+ adicionar item (ex.: carregador hotspot)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") adicionar();
          }}
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={pending || !descricao.trim()}
          className="btn-primary shrink-0"
        >
          Adicionar
        </button>
      </div>

      {/* Itens pendentes */}
      {itens.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Lista vazia. Vai apontando o que precisas de comprar.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(sel[i.id])}
                onChange={(e) => setSel((s) => ({ ...s, [i.id]: e.target.checked }))}
              />
              <span className="flex-1 text-slate-700">
                {i.quantidade > 1 ? `${i.quantidade}× ` : ""}
                {i.descricao}
              </span>
              <button
                type="button"
                onClick={() => remover(i.id)}
                disabled={pending}
                className="text-xs text-red-600 hover:underline"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Converter selecionados */}
      {itens.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {!aConverter ? (
            <button
              type="button"
              onClick={() => setAConverter(true)}
              disabled={selecionados.length === 0}
              className="btn-secondary text-xs"
            >
              Criar encomenda dos selecionados ({selecionados.length})
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Destino</label>
                <select
                  className="input"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value as EncomendaDestino)}
                >
                  {ENCOMENDA_DESTINOS.map((d) => (
                    <option key={d} value={d}>
                      {ENCOMENDA_DESTINO_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
              {destino === "proprietario" ? (
                <div>
                  <label className="label">Apartamento</label>
                  <select
                    className="input"
                    value={apartamentoId}
                    onChange={(e) => setApartamentoId(e.target.value)}
                  >
                    <option value="">—</option>
                    {apartamentos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="button"
                onClick={converter}
                disabled={pending || selecionados.length === 0}
                className="btn-primary text-xs"
              >
                Criar encomenda
              </button>
              <button
                type="button"
                onClick={() => setAConverter(false)}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
