import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustosEditor } from "@/components/CustosEditor";
import { FotosPanel } from "@/components/FotosPanel";
import { getProjeto, listCustosProjeto } from "@/lib/data/projetos";
import { listFotosProjeto } from "@/lib/data/fotos";
import { signedUrl } from "@/lib/data/storage";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { formatData } from "@/lib/format";
import { FaseControls } from "./FaseControls";
import { ProjetoForm } from "../ProjetoForm";
import { PLBreakdown } from "@/components/PLBreakdown";
import { getPLProjeto } from "@/lib/data/rentabilidade";
import {
  adicionarCustoProjeto,
  atualizarCustoProjeto,
  atualizarProjeto,
  registarAprovacao,
  removerCustoProjeto,
  removerFotoProjeto,
  uploadFotoProjeto,
  uploadOrcamento,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjetoDetalhe({
  params,
}: {
  params: { id: string };
}) {
  const proj = await getProjeto(params.id);
  if (!proj) notFound();

  const [custos, fotos, apartamentos, tecnicos, orcamentoUrl, pl] =
    await Promise.all([
      listCustosProjeto(proj.id),
      listFotosProjeto(proj.id),
      listApartamentosSelect(),
      listTecnicos(true),
      signedUrl(proj.orcamento_ficheiro),
      getPLProjeto(proj.id),
    ]);

  return (
    <>
      <PageHeader
        titulo={proj.titulo}
        descricao={`${proj.apartamento?.codigo ?? "—"} · aberto em ${formatData(proj.aberto_em)}`}
        acao={
          <Link href="/projetos" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <ProjetoForm
            apartamentos={apartamentos}
            tecnicos={tecnicos.map((t) => ({ id: t.id, nome: t.nome }))}
            action={atualizarProjeto}
            inicial={proj}
            submitLabel="Guardar projeto"
          />

          <CustosEditor
            parentField="projeto_id"
            parentId={proj.id}
            custos={custos}
            onAdd={adicionarCustoProjeto}
            onUpdate={atualizarCustoProjeto}
            onRemove={removerCustoProjeto}
          />

          <FotosPanel
            parentField="projeto_id"
            parentId={proj.id}
            fotos={fotos}
            onUpload={uploadFotoProjeto}
            onRemove={removerFotoProjeto}
          />
        </div>

        <div className="space-y-6">
          <FaseControls id={proj.id} faseAtual={proj.fase} />

          {pl ? <PLBreakdown pl={pl} semPreco={proj.orcamento_valor == null} /> : null}

          {/* Orçamento */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Orçamento
            </h3>
            <p className="text-sm text-slate-600">
              {proj.orcamento_valor != null
                ? new Intl.NumberFormat("pt-PT", {
                    style: "currency",
                    currency: "EUR",
                  }).format(proj.orcamento_valor)
                : "Por orçar"}
            </p>
            {orcamentoUrl ? (
              <a
                href={orcamentoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                📄 Ver PDF do orçamento
              </a>
            ) : null}
            <form action={uploadOrcamento} className="mt-3 space-y-2">
              <input type="hidden" name="projeto_id" value={proj.id} />
              <input
                type="file"
                name="file"
                accept="application/pdf"
                className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
              />
              <button type="submit" className="btn-secondary w-full text-xs">
                Carregar PDF
              </button>
            </form>
          </div>

          {/* Aprovação (registo manual) */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Aprovação do proprietário
            </h3>
            {proj.aprovado_em ? (
              <div className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
                Aprovado em {formatData(proj.aprovado_em)}
                {proj.aprovado_nota ? ` — ${proj.aprovado_nota}` : ""}
              </div>
            ) : (
              <p className="mb-3 text-xs text-slate-500">
                Registo manual — o proprietário não entra na app.
              </p>
            )}
            <form action={registarAprovacao} className="space-y-2">
              <input type="hidden" name="id" value={proj.id} />
              <div>
                <label className="label">Data de aprovação</label>
                <input
                  type="date"
                  name="aprovado_em"
                  defaultValue={proj.aprovado_em ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Nota</label>
                <input
                  name="aprovado_nota"
                  defaultValue={proj.aprovado_nota ?? ""}
                  className="input"
                  placeholder="ex.: aprovado por email"
                />
              </div>
              <button type="submit" className="btn-primary w-full text-xs">
                Registar aprovação → Execução
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
