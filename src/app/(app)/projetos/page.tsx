import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { FaseBadge, RegiaoBadge } from "@/components/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listProjetos } from "@/lib/data/projetos";
import { FASE_LABEL, FASE_ORDEM } from "@/lib/constants";
import { formatData, formatEuro } from "@/lib/format";
import type { ProjetoFase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: { fase?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Projetos" />
        <SetupNotice />
      </>
    );
  }

  const fase = FASE_ORDEM.includes(searchParams.fase as ProjetoFase)
    ? (searchParams.fase as ProjetoFase)
    : undefined;

  const projetos = await listProjetos({ fase });

  return (
    <>
      <PageHeader
        titulo="Projetos"
        descricao="Manutenções maiores com fases e aprovação do proprietário."
        acao={
          <Link href="/projetos/novo" className="btn-primary">
            + Novo projeto
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/projetos"
          className={`badge border px-3 py-1 ${!fase ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}
        >
          Todas as fases
        </Link>
        {FASE_ORDEM.map((f) => (
          <Link
            key={f}
            href={`/projetos?fase=${f}`}
            className={`badge border px-3 py-1 ${fase === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {FASE_LABEL[f]}
          </Link>
        ))}
      </div>

      {projetos.length === 0 ? (
        <EmptyState
          titulo="Sem projetos"
          descricao="Cria um projeto para acompanhar uma manutenção maior — orçamento, aprovação e execução."
          acao={
            <Link href="/projetos/novo" className="btn-primary">
              + Novo projeto
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projetos.map((p) => (
            <Link
              key={p.id}
              href={`/projetos/${p.id}`}
              className="card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{p.titulo}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {p.apartamento?.codigo ?? "—"}
                    </span>
                    {p.apartamento ? (
                      <RegiaoBadge regiao={p.apartamento.regiao} />
                    ) : null}
                  </div>
                </div>
                <FaseBadge fase={p.fase} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {p.orcamento_valor != null
                    ? formatEuro(p.orcamento_valor)
                    : "Por orçar"}
                </span>
                <span className="flex items-center gap-2">
                  {p.proprietario_nome ? <span>{p.proprietario_nome}</span> : null}
                  {p.tecnico ? (
                    <Avatar iniciais={p.tecnico.iniciais} size="sm" />
                  ) : null}
                  <span>{formatData(p.aberto_em)}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
