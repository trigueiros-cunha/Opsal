import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { NovaIncidenciaForm } from "./NovaIncidenciaForm";

export const dynamic = "force-dynamic";

export default async function NovaIncidenciaPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Nova incidência" />
        <SetupNotice />
      </>
    );
  }

  const [apartamentos, tecnicos] = await Promise.all([
    listApartamentosSelect(),
    listTecnicos(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Nova incidência"
        descricao="Cola uma mensagem de WhatsApp para pré-preencher, ou preenche à mão."
      />
      <NovaIncidenciaForm
        apartamentos={apartamentos}
        tecnicos={tecnicos.map((t) => ({ id: t.id, nome: t.nome }))}
      />
    </>
  );
}
