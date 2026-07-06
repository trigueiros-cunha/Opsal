"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTO_TIPOS,
  CUSTO_TIPO_LABEL,
  CUSTO_TIPO_UNIDADE,
} from "@/lib/constants";
import { formatEuro, totalLinha } from "@/lib/format";
import type { CustoTipo } from "@/lib/types";

export interface CustoRow {
  id: string;
  tipo: CustoTipo;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  origem_stock: boolean;
  stock_item_id: string | null;
}

type ActionFn = (fd: FormData) => Promise<void>;

export function CustosEditor({
  parentField,
  parentId,
  custos,
  onAdd,
  onUpdate,
  onRemove,
}: {
  parentField: "incidencia_id" | "projeto_id";
  parentId: string;
  custos: CustoRow[];
  onAdd: ActionFn;
  onUpdate: ActionFn;
  onRemove: ActionFn;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Estado local para totais em tempo real durante a edição.
  const [rows, setRows] = useState<CustoRow[]>(custos);

  // Re-sincronizar quando o servidor devolve nova lista (após adicionar/guardar/
  // remover + router.refresh). Sem isto, os itens novos não apareciam.
  useEffect(() => {
    setRows(custos);
  }, [custos]);
  const [novo, setNovo] = useState<{
    tipo: CustoTipo;
    descricao: string;
    quantidade: string;
    valor_unitario: string;
  }>({ tipo: "material", descricao: "", quantidade: "1", valor_unitario: "0" });

  const total = rows.reduce(
    (acc, r) => acc + totalLinha(r.quantidade, r.valor_unitario),
    0,
  );

  function patchRow(id: string, patch: Partial<CustoRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function guardar(row: CustoRow) {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set(parentField, parentId);
    fd.set("tipo", row.tipo);
    fd.set("descricao", row.descricao);
    fd.set("quantidade", String(row.quantidade));
    fd.set("valor_unitario", String(row.valor_unitario));
    startTransition(async () => {
      await onUpdate(fd);
      router.refresh();
    });
  }

  function remover(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set(parentField, parentId);
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(async () => {
      await onRemove(fd);
      router.refresh();
    });
  }

  function adicionar() {
    if (!novo.descricao.trim()) return;
    const fd = new FormData();
    fd.set(parentField, parentId);
    fd.set("tipo", novo.tipo);
    fd.set("descricao", novo.descricao);
    fd.set("quantidade", novo.quantidade || "1");
    fd.set("valor_unitario", novo.valor_unitario || "0");
    startTransition(async () => {
      await onAdd(fd);
      setNovo({ tipo: "material", descricao: "", quantidade: "1", valor_unitario: "0" });
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Custos</h3>
        <span className="text-sm font-semibold text-slate-900">
          Total: {formatEuro(total)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">Tipo</th>
              <th className="th">Descrição</th>
              <th className="th w-24">Qtd</th>
              <th className="th w-28">€/un</th>
              <th className="th w-24 text-right">Total</th>
              <th className="th w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td">
                  <select
                    className="input py-1"
                    value={r.tipo}
                    onChange={(e) =>
                      patchRow(r.id, { tipo: e.target.value as CustoTipo })
                    }
                  >
                    {CUSTO_TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {CUSTO_TIPO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <input
                    className="input py-1"
                    value={r.descricao}
                    onChange={(e) => patchRow(r.id, { descricao: e.target.value })}
                  />
                  {r.origem_stock ? (
                    <span className="mt-1 inline-block text-[10px] text-emerald-600">
                      ↳ stock: {r.stock_item_id ?? "—"}
                    </span>
                  ) : null}
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="0.01"
                    className="input py-1 text-right"
                    value={r.quantidade}
                    onChange={(e) =>
                      patchRow(r.id, { quantidade: Number(e.target.value) })
                    }
                  />
                  <span className="text-[10px] text-slate-400">
                    {CUSTO_TIPO_UNIDADE[r.tipo]}
                  </span>
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="0.01"
                    className="input py-1 text-right"
                    value={r.valor_unitario}
                    onChange={(e) =>
                      patchRow(r.id, { valor_unitario: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="td text-right font-medium">
                  {formatEuro(totalLinha(r.quantidade, r.valor_unitario))}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => guardar(r)}
                      disabled={pending}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(r.id)}
                      disabled={pending}
                      className="px-2 py-1 text-xs text-red-600 hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Linha nova */}
            <tr className="bg-slate-50">
              <td className="td">
                <select
                  className="input py-1"
                  value={novo.tipo}
                  onChange={(e) =>
                    setNovo({ ...novo, tipo: e.target.value as CustoTipo })
                  }
                >
                  {CUSTO_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {CUSTO_TIPO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="td">
                <input
                  className="input py-1"
                  placeholder="Descrição…"
                  value={novo.descricao}
                  onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                />
              </td>
              <td className="td">
                <input
                  type="number"
                  step="0.01"
                  className="input py-1 text-right"
                  value={novo.quantidade}
                  onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })}
                />
              </td>
              <td className="td">
                <input
                  type="number"
                  step="0.01"
                  className="input py-1 text-right"
                  value={novo.valor_unitario}
                  onChange={(e) =>
                    setNovo({ ...novo, valor_unitario: e.target.value })
                  }
                />
              </td>
              <td className="td text-right font-medium text-slate-400">
                {formatEuro(
                  totalLinha(
                    Number(novo.quantidade) || 0,
                    Number(novo.valor_unitario) || 0,
                  ),
                )}
              </td>
              <td className="td">
                <button
                  type="button"
                  onClick={adicionar}
                  disabled={pending || !novo.descricao.trim()}
                  className="btn-primary px-2 py-1 text-xs"
                >
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Materiais com origem-stock virão pré-preenchidos do catálogo externo
        (ligação futura). O campo já existe no schema.
      </p>
    </div>
  );
}
