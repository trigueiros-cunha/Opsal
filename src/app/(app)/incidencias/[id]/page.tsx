import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RegiaoBadge } from "@/components/Badges";
import { CustosEditor } from "@/components/CustosEditor";
import { FotosPanel } from "@/components/FotosPanel";
import { getIncidencia, listCustos } from "@/lib/data/incidencias";
import { listFotosIncidencia } from "@/lib/data/fotos";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { listTecnicos } from "@/lib/data/tecnicos";
import { formatDataHora } from "@/lib/format";
import { EstadoControls } from "./EstadoControls";
import { ApagarIncidencia } from "./ApagarIncidencia";
import { IncidenciaEditor } from "./IncidenciaEditor";
import { RegistoEmpresa } from "./RegistoEmpresa";
import { construirRegisto } from "@/lib/registo";
import {
  adicionarCusto,
  atualizarCusto,
  removerCusto,
  removerFoto,
  uploadFoto,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function IncidenciaDetalhe({
  params,
}: {
  params: { id: string };
}) {
  const inc = await getIncidencia(params.id);
  if (!inc) notFound();

  const [custos, fotos, apartamentos, tecnicos] = await Promise.all([
    listCustos(inc.id),
    listFotosIncidencia(inc.id),
    listApartamentosSelect(),
    listTecnicos(),
  ]);

  const registo = construirRegisto({
    notasResolucao: inc.notas_resolucao,
    tempoMinutos: inc.tempo_minutos,
    deslocacaoModo: inc.deslocacao_modo,
    deslocacaoValor: inc.deslocacao_valor,
    custos: custos.map((c) => ({
      descricao: c.descricao,
      quantidade: c.quantidade,
      valor_unitario: c.valor_unitario,
    })),
    tecnico: inc.tecnico
      ? {
          nome: inc.tecnico.nome,
          iniciais: inc.tecnico.iniciais,
          custo_hora: inc.tecnico.custo_hora,
        }
      : null,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo={inc.titulo}
        descricao={`Aberta em ${formatDataHora(inc.aberta_em)}`}
        acao={
          <div className="flex items-center gap-2">
            {inc.apartamento ? (
              <RegiaoBadge regiao={inc.apartamento.regiao} />
            ) : null}
            <Link href="/incidencias" className="btn-secondary">
              ← Voltar
            </Link>
          </div>
        }
      />

      {inc.recorrente_id ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          ↻ Gerada a partir de uma manutenção recorrente.
        </div>
      ) : null}

      <div className="space-y-6">
        {/* 1. Estado (ação mais frequente) */}
        <EstadoControls
          id={inc.id}
          estadoAtual={inc.estado}
          bloqueadaAguarda={inc.bloqueada_aguarda}
          temRecorrente={Boolean(inc.recorrente_id)}
        />

        {inc.estado === "bloqueada" && inc.bloqueada_aguarda ? (
          <div className="card border-orange-200 bg-orange-50 p-4">
            <p className="text-xs font-semibold text-orange-900">A aguardar</p>
            <p className="mt-1 text-sm text-orange-800">{inc.bloqueada_aguarda}</p>
          </div>
        ) : null}

        {/* 2. Incidência: problema + resolução, um só Guardar */}
        <IncidenciaEditor
          id={inc.id}
          titulo={inc.titulo}
          descricao={inc.descricao}
          apartamentoId={inc.apartamento_id}
          tecnicoId={inc.tecnico_id}
          prioridade={inc.prioridade}
          origem={inc.origem}
          tempoMinutos={inc.tempo_minutos}
          deslocacaoModo={inc.deslocacao_modo}
          deslocacaoValor={inc.deslocacao_valor}
          notasResolucao={inc.notas_resolucao}
          apartamentos={apartamentos}
          tecnicos={tecnicos}
        />

        {/* 3. Custos */}
        <CustosEditor
          parentField="incidencia_id"
          parentId={inc.id}
          custos={custos}
          onAdd={adicionarCusto}
          onUpdate={atualizarCusto}
          onRemove={removerCusto}
        />

        {/* 4. Fotos */}
        <FotosPanel
          parentField="incidencia_id"
          parentId={inc.id}
          fotos={fotos}
          onUpload={uploadFoto}
          onRemove={removerFoto}
        />

        {/* 5. Registo para a empresa (o resultado) */}
        <RegistoEmpresa registo={registo} />

        <ApagarIncidencia id={inc.id} />
      </div>
    </div>
  );
}
