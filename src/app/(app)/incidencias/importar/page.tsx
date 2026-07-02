import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportarPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Importar incidências" />
        <SetupNotice />
      </>
    );
  }
  return (
    <>
      <PageHeader
        titulo="Importar incidências"
        descricao="Carrega o Excel (.xlsx). Só as linhas novas entram; as que já existem são ignoradas."
      />
      <ImportWizard />
    </>
  );
}
