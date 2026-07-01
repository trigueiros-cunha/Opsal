import { FASE_LABEL, FASE_ORDEM } from "@/lib/constants";
import type { Projeto, Regiao } from "@/lib/types";

type ApSelect = { id: string; codigo: string; regiao: Regiao };

// Componente de servidor (sem estado de cliente) — reutilizado em novo/editar.
export function ProjetoForm({
  apartamentos,
  tecnicos,
  action,
  inicial,
  submitLabel,
}: {
  apartamentos: ApSelect[];
  tecnicos: { id: string; nome: string }[];
  action: (fd: FormData) => Promise<void>;
  inicial?: Projeto;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-5">
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}

      <div>
        <label className="label">Título *</label>
        <input
          name="titulo"
          required
          defaultValue={inicial?.titulo ?? ""}
          className="input"
          placeholder="ex.: Remodelação casa de banho"
        />
      </div>

      <div>
        <label className="label">Descrição</label>
        <textarea
          name="descricao"
          defaultValue={inicial?.descricao ?? ""}
          className="input h-24 resize-y"
        />
      </div>

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
          <label className="label">Fase</label>
          <select
            name="fase"
            defaultValue={inicial?.fase ?? "rascunho"}
            className="input"
          >
            {FASE_ORDEM.map((f) => (
              <option key={f} value={f}>
                {FASE_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Proprietário</label>
          <input
            name="proprietario_nome"
            defaultValue={inicial?.proprietario_nome ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label">Orçamento (€)</label>
          <input
            name="orcamento_valor"
            type="number"
            step="0.01"
            defaultValue={inicial?.orcamento_valor ?? ""}
            className="input"
            placeholder="por orçar"
          />
        </div>
        <div>
          <label className="label">Técnico</label>
          <select
            name="tecnico_id"
            defaultValue={inicial?.tecnico_id ?? ""}
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

      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
