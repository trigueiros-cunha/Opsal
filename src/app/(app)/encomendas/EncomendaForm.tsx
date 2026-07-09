"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarEncomenda, atualizarEncomenda } from "./actions";
import {
  ENCOMENDA_DESTINOS,
  ENCOMENDA_DESTINO_LABEL,
  ENCOMENDA_ESTADOS,
  ENCOMENDA_ESTADO_LABEL,
  ENCOMENDA_PAGAMENTOS,
  ENCOMENDA_PAGAMENTO_LABEL,
  METODOS_PAGAMENTO,
} from "@/lib/constants";
import type {
  Encomenda,
  EncomendaDestino,
  EncomendaEstado,
  EncomendaPagamento,
} from "@/lib/types";

type ApSelect = { id: string; codigo: string };

export function EncomendaForm({
  inicial,
  apartamentos,
}: {
  inicial: Partial<Encomenda> & { id?: string };
  apartamentos: ApSelect[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editar = Boolean(inicial.id);

  const [f, setF] = useState({
    titulo: inicial.titulo ?? "",
    destino: (inicial.destino ?? "consumo") as EncomendaDestino,
    apartamento_id: inicial.apartamento_id ?? "",
    fornecedor: inicial.fornecedor ?? "",
    data_encomenda: inicial.data_encomenda ?? "",
    estado: (inicial.estado ?? "encomendada") as EncomendaEstado,
    data_rececao: inicial.data_rececao ?? "",
    pagamento: (inicial.pagamento ?? "por_pagar") as EncomendaPagamento,
    metodo_pagamento: inicial.metodo_pagamento ?? "",
    notas: inicial.notas ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));

  function guardar() {
    const fd = new FormData();
    if (inicial.id) fd.set("id", inicial.id);
    fd.set("titulo", f.titulo);
    fd.set("destino", f.destino);
    if (f.destino === "proprietario") fd.set("apartamento_id", f.apartamento_id);
    fd.set("fornecedor", f.fornecedor);
    fd.set("data_encomenda", f.data_encomenda);
    fd.set("estado", f.estado);
    fd.set("data_rececao", f.data_rececao);
    fd.set("pagamento", f.pagamento);
    fd.set("metodo_pagamento", f.metodo_pagamento);
    fd.set("notas", f.notas);
    startTransition(async () => {
      if (editar) {
        await atualizarEncomenda(fd);
        router.refresh();
      } else {
        await criarEncomenda(fd); // redireciona para o detalhe
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={f.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            placeholder="ex.: carregadores hotspot"
          />
        </div>
        <div>
          <label className="label">Fornecedor</label>
          <input
            className="input"
            value={f.fornecedor}
            onChange={(e) => set({ fornecedor: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Destino</label>
          <select
            className="input"
            value={f.destino}
            onChange={(e) => set({ destino: e.target.value as EncomendaDestino })}
          >
            {ENCOMENDA_DESTINOS.map((d) => (
              <option key={d} value={d}>
                {ENCOMENDA_DESTINO_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        {f.destino === "proprietario" ? (
          <div>
            <label className="label">Apartamento</label>
            <select
              className="input"
              value={f.apartamento_id}
              onChange={(e) => set({ apartamento_id: e.target.value })}
            >
              <option value="">—</option>
              {apartamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div>
          <label className="label">Data da encomenda</label>
          <input
            type="date"
            className="input"
            value={f.data_encomenda}
            onChange={(e) => set({ data_encomenda: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Estado</label>
          <select
            className="input"
            value={f.estado}
            onChange={(e) => set({ estado: e.target.value as EncomendaEstado })}
          >
            {ENCOMENDA_ESTADOS.map((s) => (
              <option key={s} value={s}>
                {ENCOMENDA_ESTADO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Data de receção</label>
          <input
            type="date"
            className="input"
            value={f.data_rececao}
            onChange={(e) => set({ data_rececao: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Pagamento</label>
          <select
            className="input"
            value={f.pagamento}
            onChange={(e) =>
              set({ pagamento: e.target.value as EncomendaPagamento })
            }
          >
            {ENCOMENDA_PAGAMENTOS.map((p) => (
              <option key={p} value={p}>
                {ENCOMENDA_PAGAMENTO_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Método de pagamento</label>
          <input
            className="input"
            list="metodos-pagamento"
            value={f.metodo_pagamento}
            onChange={(e) => set({ metodo_pagamento: e.target.value })}
            placeholder="Dinheiro / Cartão / …"
          />
          <datalist id="metodos-pagamento">
            {METODOS_PAGAMENTO.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea
          className="input h-20 resize-y"
          value={f.notas}
          onChange={(e) => set({ notas: e.target.value })}
        />
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={guardar} disabled={pending}>
          {pending ? "A guardar…" : editar ? "Guardar" : "Criar encomenda"}
        </button>
      </div>
    </div>
  );
}
