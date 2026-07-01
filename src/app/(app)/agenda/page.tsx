import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listTecnicos } from "@/lib/data/tecnicos";
import { AgendaView } from "./AgendaView";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Agenda" />
        <SetupNotice />
      </>
    );
  }

  const tecnicos = await listTecnicos();

  return (
    <>
      <PageHeader
        titulo="Agenda"
        descricao="Semana de segunda a domingo. Incidências, recorrentes e projetos."
      />
      <AgendaView
        tecnicos={tecnicos.map((t) => ({
          id: t.id,
          nome: t.nome,
          iniciais: t.iniciais,
        }))}
      />
    </>
  );
}
