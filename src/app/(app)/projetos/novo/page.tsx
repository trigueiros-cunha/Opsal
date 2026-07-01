import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { ProjetoForm } from "../ProjetoForm";
import { criarProjeto } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoProjetoPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Novo projeto" />
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
        titulo="Novo projeto"
        acao={
          <Link href="/projetos" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />
      <ProjetoForm
        apartamentos={apartamentos}
        tecnicos={tecnicos.map((t) => ({ id: t.id, nome: t.nome }))}
        action={criarProjeto}
        submitLabel="Criar projeto"
      />
    </>
  );
}
