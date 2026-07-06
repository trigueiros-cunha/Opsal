import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegiaoBadge } from "@/components/Badges";
import { CustosEditor } from "@/components/CustosEditor";
import { FotosPanel } from "@/components/FotosPanel";
import { getIncidencia, listCustos } from "@/lib/data/incidencias";
import { listFotosIncidencia } from "@/lib/data/fotos";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { ORIGENS, ORIGEM_LABEL, PRIORIDADES, PRIORIDADE_LABEL } from "@/lib/constants";
import { formatDataHora } from "@/lib/format";
import { EstadoControls } from "./EstadoControls";
import { ApagarIncidencia } from "./ApagarIncidencia";
import {
  adicionarCusto,
  atualizarCusto,
  removerCusto,
  atualizarIncidencia,
  removerFoto,
  uploadFoto,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function IncidenciaDetalhe({
  params,
}: {
  params: { id: string };
}) {
  const inc = await getIncidencia(params.id);
  if (!inc) notFound();

  const [custos, fotos, apartamentos, tecnicos] = await Promise.all([
    listCustos(inc.id),
    listFotosIncidencia(inc.id),
    listApartamentosSelect(),
    listTecnicos(),
  ]);

  return (
    <>
      <PageHeader
        titulo={inc.titulo}
        descricao={`Aberta em ${formatDataHora(inc.aberta_em)}`}
        acao={
          <Link href="/incidencias" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      {inc.recorrente_id ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          ↻ Gerada a partir de uma manutenção recorrente.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Editar campos */}
          <form action={atualizarIncidencia} className="card space-y-4 p-5">
            <input type="hidden" name="id" value={inc.id} />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Detalhe</h3>
              {inc.apartamento ? (
                <RegiaoBadge regiao={inc.apartamento.regiao} />
              ) : null}
            </div>

            <div>
              <label className="label">Título</label>
              <input name="titulo" defaultValue={inc.titulo} className="input" required />
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea
                name="descricao"
                defaultValue={inc.descricao ?? ""}
                className="input h-24 resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Apartamento</label>
                <select
                  name="apartamento_id"
                  defaultValue={inc.apartamento_id}
                  className="input"
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
                  name="tecnico_id"
                  defaultValue={inc.tecnico_id ?? ""}
                  className="input"
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
                <label className="label">Prioridade</label>
                <select
                  name="prioridade"
                  defaultValue={inc.prioridade}
                  className="input"
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
                <select name="origem" defaultValue={inc.origem} className="input">
                  {ORIGENS.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABEL[o]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                Guardar detalhe
              </button>
            </div>
          </form>

          <CustosEditor
            parentField="incidencia_id"
            parentId={inc.id}
            custos={custos}
            onAdd={adicionarCusto}
            onUpdate={atualizarCusto}
            onRemove={removerCusto}
          />

          <FotosPanel
            parentField="incidencia_id"
            parentId={inc.id}
            fotos={fotos}
            onUpload={uploadFoto}
            onRemove={removerFoto}
          />
        </div>

        <div className="space-y-6">
          <EstadoControls
            id={inc.id}
            estadoAtual={inc.estado}
            bloqueadaAguarda={inc.bloqueada_aguarda}
            temRecorrente={Boolean(inc.recorrente_id)}
          />

          {inc.estado === "bloqueada" && inc.bloqueada_aguarda ? (
            <div className="card border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-semibold text-orange-900">A aguardar</p>
              <p className="mt-1 text-sm text-orange-800">
                {inc.bloqueada_aguarda}
              </p>
            </div>
          ) : null}

          {inc.notas_resolucao ? (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-700">
                Notas de resolução
              </p>
              <p className="mt-1 text-sm text-slate-600">{inc.notas_resolucao}</p>
            </div>
          ) : null}

          <ApagarIncidencia id={inc.id} />
        </div>
      </div>
    </>
  );
}
