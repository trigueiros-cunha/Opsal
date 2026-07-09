"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarLinha, atualizarLinha, removerLinha } from "../actions";
import { formatEuro, totalLinha } from "@/lib/format";
import type { EncomendaLinha } from "@/lib/types";

export function EncomendaLinhasEditor({
  encomendaId,
  linhas,
}: {
  encomendaId: string;
  linhas: EncomendaLinha[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<EncomendaLinha[]>(linhas);
  useEffect(() => setRows(linhas), [linhas]);

  const [novo, setNovo] = useState({
    descricao: "",
    quantidade: "1",
    valor_unitario: "0",
  });

  const total = rows.reduce(
    (a, r) => a + totalLinha(r.quantidade, r.valor_unitario),
    0,
  );

  function patchRow(id: string, patch: Partial<EncomendaLinha>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function guardar(row: EncomendaLinha) {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("encomenda_id", encomendaId);
    fd.set("descricao", row.descricao);
    fd.set("quantidade", String(row.quantidade));
    fd.set("valor_unitario", String(row.valor_unitario));
    startTransition(async () => {
      await atualizarLinha(fd);
      router.refresh();
    });
  }

  function remover(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("encomenda_id", encomendaId);
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(async () => {
      await removerLinha(fd);
      router.refresh();
    });
  }

  function adicionar() {
    if (!novo.descricao.trim()) return;
    const fd = new FormData();
    fd.set("encomenda_id", encomendaId);
    fd.set("descricao", novo.descricao);
    fd.set("quantidade", novo.quantidade || "1");
    fd.set("valor_unitario", novo.valor_unitario || "0");
    startTransition(async () => {
      await adicionarLinha(fd);
      setNovo({ descricao: "", quantidade: "1", valor_unitario: "0" });
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Artigos</h3>
        <span className="text-sm font-semibold text-slate-900">
          Total: {formatEuro(total)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">Descrição</th>
              <th className="th w-24">Qtd</th>
              <th className="th w-28">€/un</th>
              <th className="th w-24 text-right">Total</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td">
                  <input
                    className="input py-1"
                    value={r.descricao}
                    onChange={(e) => patchRow(r.id, { descricao: e.target.value })}
                  />
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

            <tr className="bg-slate-50">
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
                  Adicionar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
