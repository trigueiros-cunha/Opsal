import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { resumoDia, listNaoRentaveis } from "@/lib/data/rentabilidade";
import { formatEuro, toISODate } from "@/lib/format";
import { SeletorData } from "./SeletorData";
import { CartaoTecnico } from "./CartaoTecnico";

export const dynamic = "force-dynamic";

export default async function RentabilidadePage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Rentabilidade" />
        <SetupNotice />
      </>
    );
  }

  const data = searchParams.data || toISODate(new Date());
  const [grupos, naoRentaveis] = await Promise.all([
    resumoDia(data),
    listNaoRentaveis(),
  ]);

  const algumNegativo = grupos.some((g) => g.resumo.resultado < 0);

  return (
    <>
      <PageHeader
        titulo="Rentabilidade"
        descricao="Ganhamos ou perdemos por intervenção — por técnico e por dia."
        acao={
          <div className="flex items-center gap-2">
            <SeletorData data={data} />
            <Link href="/rentabilidade/config" className="btn-secondary">
              Config
            </Link>
          </div>
        }
      />

      {algumNegativo ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ Há técnico(s) com resultado negativo neste dia.
        </div>
      ) : null}

      {grupos.length === 0 ? (
        <EmptyState
          titulo="Sem intervenções concluídas"
          descricao="Nenhuma incidência resolvida nesta data."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => (
            <CartaoTecnico key={g.tecnico?.id ?? "sem"} grupo={g} />
          ))}
        </div>
      )}

      {/* Não rentáveis */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Não rentáveis
        </h2>
        {naoRentaveis.length === 0 ? (
          <EmptyState
            titulo="Tudo positivo"
            descricao="Nenhuma intervenção ou obra concluída com prejuízo."
          />
        ) : (
          <div className="space-y-2">
            {naoRentaveis.map((l) => (
              <Link
                key={`${l.kind}-${l.id}`}
                href={l.kind === "inc" ? `/incidencias/${l.id}` : `/projetos/${l.id}`}
                className="card flex items-center justify-between gap-2 p-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {l.titulo}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {l.apartamento_codigo} · {l.kind === "inc" ? "Incidência" : "Obra"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-red-600">
                  {formatEuro(l.valor)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
