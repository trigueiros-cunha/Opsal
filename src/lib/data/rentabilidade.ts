import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/data/config";
import {
  custoHoraCarregado,
  plIncidencia,
  plProjeto,
  resumoTecnicoDia,
  type PL,
  type ResumoDia,
} from "@/lib/custo";

type Db = ReturnType<typeof supabaseAdmin>;

const ESTADOS_CONCLUIDAS = ["resolvida", "fechada"] as const;

export interface ItemPL {
  id: string;
  titulo: string;
  apartamento_codigo: string;
  tempoMinutos: number | null;
  pl: PL;
}

export interface ResumoTecnico {
  tecnico: { id: string; nome: string; iniciais: string } | null;
  resumo: ResumoDia;
  itens: ItemPL[];
}

export interface LinhaNaoRentavel {
  kind: "inc" | "proj";
  id: string;
  titulo: string;
  apartamento_codigo: string;
  rentabilidade: number;
}

interface IncRow {
  id: string;
  titulo: string;
  tempo_minutos: number | null;
  deslocacao_valor: number | null;
  preco_proprietario: number | null;
  tecnico_id: string | null;
  apartamento: { codigo: string } | null;
  tecnico: { id: string; nome: string; iniciais: string; custo_hora: number } | null;
}

const SELECT_INC_PL = `
  id, titulo, tempo_minutos, deslocacao_valor, preco_proprietario, tecnico_id,
  apartamento:apartamentos ( codigo ),
  tecnico:tecnicos ( id, nome, iniciais, custo_hora )
`;

/** Σ (quantidade × valor_unitario) de linhas tipo 'material' por incidência. */
async function materiaisPorIncidencia(
  db: Db,
  ids: string[],
): Promise<Map<string, number>> {
  const soma = new Map<string, number>();
  if (ids.length === 0) return soma;
  const { data, error } = await db
    .from("incidencia_custos")
    .select("incidencia_id, quantidade, valor_unitario")
    .in("incidencia_id", ids)
    .eq("tipo", "material");
  if (error) throw error;
  for (const r of data ?? []) {
    const row = r as {
      incidencia_id: string;
      quantidade: number;
      valor_unitario: number;
    };
    soma.set(
      row.incidencia_id,
      (soma.get(row.incidencia_id) ?? 0) + row.quantidade * row.valor_unitario,
    );
  }
  return soma;
}

function itemDeIncidencia(
  row: IncRow,
  materiais: number,
  taxaEncargos: number,
): ItemPL {
  const pl = plIncidencia({
    tempoMinutos: row.tempo_minutos,
    custoHoraCarregado: row.tecnico
      ? custoHoraCarregado(row.tecnico.custo_hora, taxaEncargos)
      : null,
    deslocacaoValor: row.deslocacao_valor,
    custosMateriais: materiais,
    precoProprietario: row.preco_proprietario,
  });
  return {
    id: row.id,
    titulo: row.titulo,
    apartamento_codigo: row.apartamento?.codigo ?? "—",
    tempoMinutos: row.tempo_minutos,
    pl,
  };
}

/** Resumo por técnico das incidências concluídas num dado dia (data efetiva de resolução). */
export async function resumoDia(dataISO: string): Promise<ResumoTecnico[]> {
  const db = supabaseAdmin();
  const cfg = await getConfig();

  const inicio = new Date(dataISO + "T00:00:00");
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  const { data, error } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .in("estado", ESTADOS_CONCLUIDAS as unknown as string[])
    .gte("resolvida_em", inicio.toISOString())
    .lt("resolvida_em", fim.toISOString());
  if (error) throw error;

  const rows = (data ?? []) as unknown as IncRow[];
  const materiais = await materiaisPorIncidencia(
    db,
    rows.map((r) => r.id),
  );

  // Agrupar por técnico (chave null → bucket "sem técnico").
  const grupos = new Map<string, { tecnico: IncRow["tecnico"]; itens: ItemPL[] }>();
  for (const row of rows) {
    const chave = row.tecnico?.id ?? "__sem__";
    if (!grupos.has(chave)) grupos.set(chave, { tecnico: row.tecnico, itens: [] });
    grupos
      .get(chave)!
      .itens.push(itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct));
  }

  const resultado: ResumoTecnico[] = [];
  for (const { tecnico, itens } of grupos.values()) {
    const chc = tecnico
      ? custoHoraCarregado(tecnico.custo_hora, cfg.taxa_encargos_pct)
      : 0;
    resultado.push({
      tecnico: tecnico
        ? { id: tecnico.id, nome: tecnico.nome, iniciais: tecnico.iniciais }
        : null,
      resumo: resumoTecnicoDia(
        itens.map((it) => ({ pl: it.pl, tempoMinutos: it.tempoMinutos })),
        { horasDiaPadrao: cfg.horas_dia_padrao, custoHoraCarregado: chc },
      ),
      itens,
    });
  }
  // Técnicos primeiro (piores/melhores por resultado desc), "sem técnico" no fim.
  resultado.sort((a, b) => {
    if (!a.tecnico) return 1;
    if (!b.tecnico) return -1;
    return b.resumo.resultado - a.resumo.resultado;
  });
  return resultado;
}

export async function getPLIncidencia(id: string): Promise<PL | null> {
  const db = supabaseAdmin();
  const cfg = await getConfig();
  const { data, error } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as IncRow;
  const materiais = await materiaisPorIncidencia(db, [row.id]);
  return itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct).pl;
}

/** Σ (quantidade × valor_unitario) de todas as linhas de um projeto. */
async function somaCustosProjeto(db: Db, projetoId: string): Promise<number> {
  const { data, error } = await db
    .from("projeto_custos")
    .select("quantidade, valor_unitario")
    .eq("projeto_id", projetoId);
  if (error) throw error;
  return (data ?? []).reduce((a, r) => {
    const row = r as { quantidade: number; valor_unitario: number };
    return a + row.quantidade * row.valor_unitario;
  }, 0);
}

export async function getPLProjeto(id: string): Promise<PL | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("projetos")
    .select("id, orcamento_valor")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const proj = data as { id: string; orcamento_valor: number | null };
  const custos = await somaCustosProjeto(db, proj.id);
  return plProjeto({ custos, orcamentoValor: proj.orcamento_valor });
}

/** Incidências concluídas + projetos concluídos com rentabilidade < 0, piores primeiro. */
export async function listNaoRentaveis(): Promise<LinhaNaoRentavel[]> {
  const db = supabaseAdmin();
  const cfg = await getConfig();
  const linhas: LinhaNaoRentavel[] = [];

  // Incidências concluídas
  const { data: incs, error: incErr } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .in("estado", ESTADOS_CONCLUIDAS as unknown as string[]);
  if (incErr) throw incErr;
  const incRows = (incs ?? []) as unknown as IncRow[];
  const materiais = await materiaisPorIncidencia(db, incRows.map((r) => r.id));
  for (const row of incRows) {
    const item = itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct);
    if (item.pl.rentabilidade < 0) {
      linhas.push({
        kind: "inc",
        id: row.id,
        titulo: row.titulo,
        apartamento_codigo: item.apartamento_codigo,
        rentabilidade: item.pl.rentabilidade,
      });
    }
  }

  // Projetos concluídos
  const { data: projs, error: projErr } = await db
    .from("projetos")
    .select("id, titulo, orcamento_valor, apartamento:apartamentos ( codigo )")
    .eq("fase", "concluido");
  if (projErr) throw projErr;
  for (const p of projs ?? []) {
    const proj = p as unknown as {
      id: string;
      titulo: string;
      orcamento_valor: number | null;
      apartamento: { codigo: string } | null;
    };
    const custos = await somaCustosProjeto(db, proj.id);
    const pl = plProjeto({ custos, orcamentoValor: proj.orcamento_valor });
    if (pl.rentabilidade < 0) {
      linhas.push({
        kind: "proj",
        id: proj.id,
        titulo: proj.titulo,
        apartamento_codigo: proj.apartamento?.codigo ?? "—",
        rentabilidade: pl.rentabilidade,
      });
    }
  }

  linhas.sort((a, b) => a.rentabilidade - b.rentabilidade); // pior (mais negativo) primeiro
  return linhas;
}
