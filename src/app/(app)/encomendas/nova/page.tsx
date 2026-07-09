import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { EncomendaForm } from "../EncomendaForm";

export const dynamic = "force-dynamic";

export default async function NovaEncomendaPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Nova encomenda" />
        <SetupNotice />
      </>
    );
  }

  const apartamentos = await listApartamentosSelect();

  return (
    <>
      <PageHeader
        titulo="Nova encomenda"
        descricao="Depois de criar, adiciona os artigos e a fatura no detalhe."
        acao={
          <Link href="/encomendas" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl">
        <EncomendaForm
          inicial={{}}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />
      </div>
    </>
  );
}
