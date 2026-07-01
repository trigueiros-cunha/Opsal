import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import {
  EstadoBadge,
  PrioridadeBadge,
  SemaforoBadge,
} from "@/components/Badges";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import {
  contarPorEstado,
  contarResolvidasDesde,
  listArdeHoje,
} from "@/lib/data/incidencias";
import { contarAVencer, listVencidas } from "@/lib/data/recorrentes";
import { contarPorFase, listAguardaAprovacao } from "@/lib/data/projetos";
import { RECORRENTE_TIPO_LABEL } from "@/lib/constants";
import { formatData, formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HojePage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Hoje"
          descricao="Painel transversal do dia."
        />
        <SetupNotice />
      </>
    );
  }

  const [
    porEstado,
    resolvidasSemana,
    ardeIncidencias,
    recorrentesVencidas,
    aVencer,
    porFase,
    aguardaAprovacao,
  ] = await Promise.all([
    contarPorEstado(),
    contarResolvidasDesde(7),
    listArdeHoje(),
    listVencidas(),
    contarAVencer(),
    contarPorFase(),
    listAguardaAprovacao(),
  ]);

  const abertas =
    porEstado.aberta + porEstado.em_curso + porEstado.bloqueada;

  return (
    <>
      <PageHeader
        titulo="Hoje"
        descricao="O que arde, o que espera por ti, e os números do dia."
      />

      {/* KPIs */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Incidências abertas"
          valor={abertas}
          href="/incidencias"
          tom={abertas > 0 ? "default" : "ok"}
        />
        <StatCard
          label="Recorrentes a vencer"
          valor={aVencer}
          href="/recorrentes"
          tom={aVencer > 0 ? "aviso" : "ok"}
        />
        <StatCard
          label="Projetos à espera"
          valor={porFase.aprovacao}
          href="/projetos?fase=aprovacao"
          tom={porFase.aprovacao > 0 ? "aviso" : "ok"}
        />
        <StatCard
          label="Resolvidas (7 dias)"
          valor={resolvidasSemana}
          hint="incidências fechadas/resolvidas"
          tom="ok"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Arde hoje */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            🔥 Arde hoje
          </h2>
          <div className="space-y-2">
            {ardeIncidencias.length === 0 && recorrentesVencidas.length === 0 ? (
              <EmptyState
                titulo="Nada a arder"
                descricao="Sem incidências de prioridade alta nem recorrentes vencidas. Bom dia."
              />
            ) : (
              <>
                {ardeIncidencias.map((i) => (
                  <Link
                    key={i.id}
                    href={`/incidencias/${i.id}`}
                    className="card flex items-center justify-between gap-2 p-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {i.titulo}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {i.apartamento?.codigo ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PrioridadeBadge prioridade={i.prioridade} />
                      <EstadoBadge estado={i.estado} />
                    </div>
                  </Link>
                ))}
                {recorrentesVencidas.map((r) => (
                  <Link
                    key={r.id}
                    href="/recorrentes"
                    className="card flex items-center justify-between gap-2 p-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {RECORRENTE_TIPO_LABEL[r.tipo]}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {r.apartamento_codigo} · venceu {formatData(r.proxima_data)}
                      </p>
                    </div>
                    <SemaforoBadge semaforo={r.semaforo} />
                  </Link>
                ))}
              </>
            )}
          </div>
        </section>

        {/* À espera de ti */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            ⏳ À espera de ti
          </h2>
          <div className="space-y-2">
            {aguardaAprovacao.length === 0 ? (
              <EmptyState
                titulo="Nada pendente"
                descricao="Nenhum projeto à espera de decisão do proprietário."
              />
            ) : (
              aguardaAprovacao.map((p) => (
                <Link
                  key={p.id}
                  href={`/projetos/${p.id}`}
                  className="card flex items-center justify-between gap-2 p-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.titulo}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {p.apartamento?.codigo ?? "—"}
                      {p.proprietario_nome ? ` · ${p.proprietario_nome}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {p.orcamento_valor != null
                      ? formatEuro(p.orcamento_valor)
                      : "por orçar"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
