import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { SemaforoBadge, RegiaoBadge } from "@/components/Badges";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listRecorrentesEstado } from "@/lib/data/recorrentes";
import {
  RECORRENTE_TIPOS,
  RECORRENTE_TIPO_LABEL,
} from "@/lib/constants";
import { formatData } from "@/lib/format";
import type { RecorrenteTipo } from "@/lib/types";
import { gerarIncidenciaDeRecorrente, desativarRecorrente } from "./actions";

export const dynamic = "force-dynamic";

function diasTexto(d: number): string {
  if (d < 0) return `há ${Math.abs(d)} d`;
  if (d === 0) return "hoje";
  return `em ${d} d`;
}

export default async function RecorrentesPage({
  searchParams,
}: {
  searchParams: { tipo?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Recorrentes" />
        <SetupNotice />
      </>
    );
  }

  const tipo = RECORRENTE_TIPOS.includes(searchParams.tipo as RecorrenteTipo)
    ? (searchParams.tipo as RecorrenteTipo)
    : undefined;

  const recorrentes = await listRecorrentesEstado({ tipo });

  return (
    <>
      <PageHeader
        titulo="Recorrentes"
        descricao="Regras por calendário. O semáforo e a próxima data são calculados."
        acao={
          <Link href="/recorrentes/nova" className="btn-primary">
            + Nova regra
          </Link>
        }
      />

      {/* Filtro por tipo */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/recorrentes"
          className={`badge border px-3 py-1 ${
            !tipo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          Todas
        </Link>
        {RECORRENTE_TIPOS.map((t) => (
          <Link
            key={t}
            href={`/recorrentes?tipo=${t}`}
            className={`badge border px-3 py-1 ${
              tipo === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {RECORRENTE_TIPO_LABEL[t]}
          </Link>
        ))}
      </div>

      {recorrentes.length === 0 ? (
        <EmptyState
          titulo="Sem regras recorrentes"
          descricao="Cria uma regra (ex.: filtros AC a cada 3 meses) e o OPSAL avisa-te quando vencer."
          acao={
            <Link href="/recorrentes/nova" className="btn-primary">
              + Nova regra
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Semáforo</th>
                <th className="th">Apart.</th>
                <th className="th">Tipo</th>
                <th className="th">Ciclo</th>
                <th className="th">Última</th>
                <th className="th">Próxima</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recorrentes.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td">
                    <SemaforoBadge semaforo={r.semaforo} />
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {r.apartamento_codigo}
                      </span>
                      <RegiaoBadge regiao={r.regiao} />
                    </div>
                  </td>
                  <td className="td">{RECORRENTE_TIPO_LABEL[r.tipo]}</td>
                  <td className="td text-xs text-slate-500">{r.ciclo_meses} m</td>
                  <td className="td text-xs">{formatData(r.ultima_intervencao)}</td>
                  <td className="td">
                    <div className="text-sm">{formatData(r.proxima_data)}</div>
                    <div
                      className={`text-[11px] ${
                        r.dias_restantes < 0 ? "text-red-600" : "text-slate-400"
                      }`}
                    >
                      {diasTexto(r.dias_restantes)}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1">
                      <form action={gerarIncidenciaDeRecorrente}>
                        <input type="hidden" name="recorrente_id" value={r.id} />
                        <button className="btn-primary px-2.5 py-1 text-xs">
                          Gerar incidência
                        </button>
                      </form>
                      <Link
                        href={`/recorrentes/${r.id}`}
                        className="px-2 py-1 text-xs text-slate-500 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={desativarRecorrente}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="px-2 py-1 text-xs text-red-500 hover:underline">
                          Arquivar
                        </button>
                      </form>
                    </div>
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
