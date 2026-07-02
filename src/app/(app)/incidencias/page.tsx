import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { Avatar } from "@/components/ui/Avatar";
import {
  EstadoBadge,
  PrioridadeBadge,
  RegiaoBadge,
} from "@/components/Badges";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listIncidencias } from "@/lib/data/incidencias";
import { listTecnicos } from "@/lib/data/tecnicos";
import { ESTADOS, ESTADO_LABEL, REGIOES, REGIAO_LABEL } from "@/lib/constants";
import { formatData } from "@/lib/format";
import type { IncidenciaEstado, Regiao } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IncidenciasPage({
  searchParams,
}: {
  searchParams: { estado?: string; regiao?: string; tecnico?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Incidências" />
        <SetupNotice />
      </>
    );
  }

  const estado = ESTADOS.includes(searchParams.estado as IncidenciaEstado)
    ? (searchParams.estado as IncidenciaEstado)
    : undefined;
  const regiao = REGIOES.includes(searchParams.regiao as Regiao)
    ? (searchParams.regiao as Regiao)
    : undefined;
  const tecnico = searchParams.tecnico || undefined;

  const [incidencias, tecnicos] = await Promise.all([
    listIncidencias({ estado, regiao, tecnico_id: tecnico }),
    listTecnicos(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Incidências"
        descricao={`${incidencias.length} ${incidencias.length === 1 ? "resultado" : "resultados"}`}
        acao={
          <>
            <Link href="/incidencias/importar" className="btn-secondary">
              Importar
            </Link>
            <Link href="/incidencias/nova" className="btn-primary">
              + Nova incidência
            </Link>
          </>
        }
      />

      {/* Filtros (GET) */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Estado</label>
          <select name="estado" defaultValue={estado ?? ""} className="input min-w-[10rem]">
            <option value="">Todos (exceto fechadas)</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Região</label>
          <select name="regiao" defaultValue={regiao ?? ""} className="input min-w-[9rem]">
            <option value="">Todas</option>
            {REGIOES.map((r) => (
              <option key={r} value={r}>
                {REGIAO_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Técnico</label>
          <select name="tecnico" defaultValue={tecnico ?? ""} className="input min-w-[10rem]">
            <option value="">Todos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
        <Link href="/incidencias" className="btn-secondary">
          Limpar
        </Link>
      </form>

      {incidencias.length === 0 ? (
        <EmptyState
          titulo="Sem incidências"
          descricao="Cria a primeira incidência ou ajusta os filtros. A base começa limpa — enche-se com o uso."
          acao={
            <Link href="/incidencias/nova" className="btn-primary">
              + Nova incidência
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Apart.</th>
                <th className="th">Título</th>
                <th className="th">Prioridade</th>
                <th className="th">Estado</th>
                <th className="th">Técnico</th>
                <th className="th">Aberta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidencias.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {i.apartamento?.codigo ?? "—"}
                      </span>
                      {i.apartamento ? (
                        <RegiaoBadge regiao={i.apartamento.regiao} />
                      ) : null}
                    </div>
                  </td>
                  <td className="td">
                    <Link
                      href={`/incidencias/${i.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {i.titulo}
                    </Link>
                  </td>
                  <td className="td">
                    <PrioridadeBadge prioridade={i.prioridade} />
                  </td>
                  <td className="td">
                    <EstadoBadge estado={i.estado} />
                  </td>
                  <td className="td">
                    {i.tecnico ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar iniciais={i.tecnico.iniciais} size="sm" />
                        <span className="text-xs">{i.tecnico.nome}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Por atribuir</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">
                    {formatData(i.aberta_em)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
