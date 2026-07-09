import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { Badge } from "@/components/ui/Badge";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listEncomendas } from "@/lib/data/encomendas";
import { listPendentes } from "@/lib/data/lista_compras";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { formatData, formatEuro } from "@/lib/format";
import {
  ENCOMENDA_DESTINO_CLASSE,
  ENCOMENDA_DESTINO_LABEL,
  ENCOMENDA_ESTADO_LABEL,
  ENCOMENDA_PAGAMENTO_CLASSE,
  ENCOMENDA_PAGAMENTO_LABEL,
} from "@/lib/constants";
import { ListaCompras } from "./ListaCompras";

export const dynamic = "force-dynamic";

export default async function EncomendasPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Encomendas" />
        <SetupNotice />
      </>
    );
  }

  const [encomendas, pendentes, apartamentos] = await Promise.all([
    listEncomendas(),
    listPendentes(),
    listApartamentosSelect(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Encomendas"
        descricao="Compras da empresa — proprietário, stock ou consumo. Fora do P&L."
        acao={
          <Link href="/encomendas/nova" className="btn-primary">
            + Nova encomenda
          </Link>
        }
      />

      <div className="mb-6">
        <ListaCompras
          itens={pendentes}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Encomendas</h2>
        {encomendas.length === 0 ? (
          <EmptyState
            titulo="Sem encomendas"
            descricao="Ainda não registaste nenhuma compra."
          />
        ) : (
          <div className="space-y-2">
            {encomendas.map((e) => (
              <Link
                key={e.id}
                href={`/encomendas/${e.id}`}
                className="card flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {e.titulo || e.fornecedor || "Encomenda"}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {formatData(e.data_encomenda)}
                    {e.apartamento ? ` · ${e.apartamento.codigo}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge className={ENCOMENDA_DESTINO_CLASSE[e.destino]}>
                    {ENCOMENDA_DESTINO_LABEL[e.destino]}
                  </Badge>
                  <Badge className={ENCOMENDA_PAGAMENTO_CLASSE[e.pagamento]}>
                    {ENCOMENDA_PAGAMENTO_LABEL[e.pagamento]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {ENCOMENDA_ESTADO_LABEL[e.estado]}
                  </span>
                  <span className="w-20 text-right text-sm font-semibold text-slate-900">
                    {formatEuro(e.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
