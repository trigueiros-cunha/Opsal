import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { getEncomenda, listLinhas } from "@/lib/data/encomendas";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { formatEuro } from "@/lib/format";
import { EncomendaForm } from "../EncomendaForm";
import { EncomendaLinhasEditor } from "./EncomendaLinhasEditor";
import { apagarEncomenda } from "../actions";

export const dynamic = "force-dynamic";

export default async function EncomendaDetalhe({
  params,
}: {
  params: { id: string };
}) {
  if (!supabaseConfigurado()) return notFound();

  const enc = await getEncomenda(params.id);
  if (!enc) notFound();

  const [linhas, apartamentos] = await Promise.all([
    listLinhas(enc.id),
    listApartamentosSelect(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo={enc.titulo || enc.fornecedor || "Encomenda"}
        descricao={`Total ${formatEuro(enc.total)}`}
        acao={
          <Link href="/encomendas" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      <div className="space-y-6">
        <EncomendaForm
          inicial={enc}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />

        <EncomendaLinhasEditor encomendaId={enc.id} linhas={linhas} />

        <form action={apagarEncomenda} className="flex justify-end">
          <input type="hidden" name="id" value={enc.id} />
          <button type="submit" className="text-xs text-red-600 hover:underline">
            Apagar encomenda
          </button>
        </form>
      </div>
    </div>
  );
}
