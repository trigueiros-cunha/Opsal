import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { RecorrenteForm } from "../RecorrenteForm";
import { atualizarRecorrente } from "../actions";
import type { Recorrente } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditarRecorrentePage({
  params,
}: {
  params: { id: string };
}) {
  const { data, error } = await supabaseAdmin()
    .from("recorrentes")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const rec = data as Recorrente;

  const [apartamentos, tecnicos] = await Promise.all([
    listApartamentosSelect(),
    listTecnicos(true),
  ]);

  return (
    <>
      <PageHeader
        titulo="Editar regra recorrente"
        acao={
          <Link href="/recorrentes" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />
      <RecorrenteForm
        apartamentos={apartamentos}
        tecnicos={tecnicos.map((t) => ({ id: t.id, nome: t.nome }))}
        action={atualizarRecorrente}
        inicial={rec}
        submitLabel="Guardar alterações"
      />
    </>
  );
}
