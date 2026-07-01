import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { RecorrenteForm } from "../RecorrenteForm";
import { criarRecorrente } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaRecorrentePage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Nova regra recorrente" />
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
        titulo="Nova regra recorrente"
        acao={
          <Link href="/recorrentes" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />
      <RecorrenteForm
        apartamentos={apartamentos}
        tecnicos={tecnicos.map((t) => ({ id: t.id, nome: t.nome }))}
        action={criarRecorrente}
        submitLabel="Criar regra"
      />
    </>
  );
}
