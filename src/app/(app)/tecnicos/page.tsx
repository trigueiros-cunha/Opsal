import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { ModalForm } from "@/components/ModalForm";
import { Avatar } from "@/components/ui/Avatar";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { cargaPorTecnico, listTecnicos } from "@/lib/data/tecnicos";
import { formatEuro } from "@/lib/format";
import {
  alternarAtivoTecnico,
  atualizarTecnico,
  criarTecnico,
} from "./actions";
import type { Tecnico } from "@/lib/types";

export const dynamic = "force-dynamic";

function CampoTecnico({ t }: { t?: Tecnico }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Nome *</label>
        <input name="nome" required defaultValue={t?.nome ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Iniciais *</label>
        <input
          name="iniciais"
          required
          maxLength={3}
          defaultValue={t?.iniciais ?? ""}
          className="input"
          placeholder="RC"
        />
      </div>
      <div className="col-span-2">
        <label className="label">Especialidades (separadas por vírgula)</label>
        <input
          name="especialidades"
          defaultValue={t?.especialidades?.join(", ") ?? ""}
          className="input"
          placeholder="Canalização, Eletricidade"
        />
      </div>
      <div>
        <label className="label">Contacto</label>
        <input name="contacto" defaultValue={t?.contacto ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Custo/hora (€)</label>
        <input
          name="custo_hora"
          type="number"
          step="0.01"
          defaultValue={t?.custo_hora ?? 0}
          className="input"
        />
      </div>
    </div>
  );
}

export default async function TecnicosPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Técnicos" />
        <SetupNotice />
      </>
    );
  }

  const [tecnicos, carga] = await Promise.all([
    listTecnicos(true),
    cargaPorTecnico(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Técnicos"
        descricao="Recurso: especialidade, contacto, custo/hora. A carga conta incidências ativas."
        acao={
          <ModalForm
            label="+ Novo técnico"
            title="Novo técnico"
            action={criarTecnico}
            buttonClassName="btn-primary"
          >
            <CampoTecnico />
            <div className="flex justify-end">
              <button className="btn-primary">Criar</button>
            </div>
          </ModalForm>
        }
      />

      {tecnicos.length === 0 ? (
        <EmptyState
          titulo="Sem técnicos"
          descricao="Adiciona os técnicos que trabalham no portfólio para os poderes atribuir a incidências."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tecnicos.map((t) => (
            <div
              key={t.id}
              className={`card p-4 ${t.ativo ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar iniciais={t.iniciais} titulo={t.nome} />
                  <div>
                    <p className="font-semibold text-slate-900">{t.nome}</p>
                    <p className="text-xs text-slate-500">
                      {formatEuro(t.custo_hora)}/h
                    </p>
                  </div>
                </div>
                <span className="badge border-slate-200 bg-slate-50 text-slate-600">
                  {carga[t.id] ?? 0} ativas
                </span>
              </div>

              {t.especialidades && t.especialidades.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {t.especialidades.map((e) => (
                    <span
                      key={e}
                      className="badge border-slate-200 bg-slate-50 text-slate-600"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              ) : null}

              {t.contacto ? (
                <p className="mt-2 text-xs text-slate-500">{t.contacto}</p>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <ModalForm
                  label="Editar"
                  title={`Editar ${t.nome}`}
                  action={atualizarTecnico}
                  buttonClassName="cursor-pointer text-xs text-slate-500 hover:underline"
                >
                  <input type="hidden" name="id" value={t.id} />
                  <CampoTecnico t={t} />
                  <div className="flex items-center justify-between">
                    <select
                      name="ativo"
                      defaultValue={t.ativo ? "true" : "false"}
                      className="input w-32"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                    <button className="btn-primary">Guardar</button>
                  </div>
                </ModalForm>
                <form action={alternarAtivoTecnico}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="ativo" value={String(t.ativo)} />
                  <button className="text-xs text-slate-400 hover:underline">
                    {t.ativo ? "Desativar" : "Reativar"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
