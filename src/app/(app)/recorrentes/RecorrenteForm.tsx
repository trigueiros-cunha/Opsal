"use client";

import { useState } from "react";
import {
  RECORRENTE_CICLO_TIPICO,
  RECORRENTE_TIPOS,
  RECORRENTE_TIPO_LABEL,
} from "@/lib/constants";
import type { Recorrente, RecorrenteTipo, Regiao } from "@/lib/types";

type ApSelect = { id: string; codigo: string; regiao: Regiao };

export function RecorrenteForm({
  apartamentos,
  tecnicos,
  action,
  inicial,
  submitLabel,
}: {
  apartamentos: ApSelect[];
  tecnicos: { id: string; nome: string }[];
  action: (fd: FormData) => Promise<void>;
  inicial?: Recorrente;
  submitLabel: string;
}) {
  const [tipo, setTipo] = useState<RecorrenteTipo>(inicial?.tipo ?? "filtros_ac");
  const [ciclo, setCiclo] = useState<number>(
    inicial?.ciclo_meses ?? RECORRENTE_CICLO_TIPICO["filtros_ac"],
  );

  function onTipo(novo: RecorrenteTipo) {
    setTipo(novo);
    // Sugere o ciclo típico só em criação (sem inicial).
    if (!inicial) setCiclo(RECORRENTE_CICLO_TIPICO[novo]);
  }

  return (
    <form action={action} className="card max-w-2xl space-y-4 p-5">
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Apartamento *</label>
          <select
            name="apartamento_id"
            required
            defaultValue={inicial?.apartamento_id ?? ""}
            className="input"
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
          <label className="label">Tipo *</label>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => onTipo(e.target.value as RecorrenteTipo)}
            className="input"
          >
            {RECORRENTE_TIPOS.map((t) => (
              <option key={t} value={t}>
                {RECORRENTE_TIPO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ciclo (meses) *</label>
          <input
            type="number"
            name="ciclo_meses"
            min={1}
            required
            value={ciclo}
            onChange={(e) => setCiclo(Number(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Aviso prévio (dias)</label>
          <input
            type="number"
            name="aviso_previo_dias"
            min={0}
            defaultValue={inicial?.aviso_previo_dias ?? 15}
            className="input"
          />
        </div>
        <div>
          <label className="label">Última intervenção *</label>
          <input
            type="date"
            name="ultima_intervencao"
            required
            defaultValue={inicial?.ultima_intervencao ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label">Técnico habitual</label>
          <select
            name="tecnico_habitual_id"
            defaultValue={inicial?.tecnico_habitual_id ?? ""}
            className="input"
          >
            <option value="">—</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {inicial ? (
        <div className="w-40">
          <label className="label">Estado</label>
          <select
            name="ativo"
            defaultValue={inicial.ativo ? "true" : "false"}
            className="input"
          >
            <option value="true">Ativa</option>
            <option value="false">Arquivada</option>
          </select>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
