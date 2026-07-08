import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Incidencia,
  IncidenciaComRelacoes,
  IncidenciaCusto,
  IncidenciaEstado,
  Regiao,
} from "@/lib/types";

const SELECT_COM_RELACOES = `
  *,
  apartamento:apartamentos ( id, codigo, regiao ),
  tecnico:tecnicos ( id, nome, iniciais, custo_hora )
`;

export interface FiltrosIncidencias {
  estado?: IncidenciaEstado;
  regiao?: Regiao;
  tecnico_id?: string;
  apartamento_id?: string;
  incluirFechadas?: boolean;
}

export async function listIncidencias(
  filtros: FiltrosIncidencias = {},
): Promise<IncidenciaComRelacoes[]> {
  let query = supabaseAdmin()
    .from("incidencias")
    .select(SELECT_COM_RELACOES)
    .order("aberta_em", { ascending: false });

  if (filtros.estado) query = query.eq("estado", filtros.estado);
  else if (!filtros.incluirFechadas)
    query = query.not("estado", "eq", "fechada");

  if (filtros.tecnico_id) query = query.eq("tecnico_id", filtros.tecnico_id);
  if (filtros.apartamento_id)
    query = query.eq("apartamento_id", filtros.apartamento_id);

  const { data, error } = await query;
  if (error) throw error;

  let linhas = (data ?? []) as unknown as IncidenciaComRelacoes[];
  // Filtro por região aplica-se ao apartamento (join) — feito em memória.
  if (filtros.regiao) {
    linhas = linhas.filter((i) => i.apartamento?.regiao === filtros.regiao);
  }
  return linhas;
}

export async function getIncidencia(
  id: string,
): Promise<IncidenciaComRelacoes | null> {
  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .select(SELECT_COM_RELACOES)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as IncidenciaComRelacoes) ?? null;
}

export async function listCustos(
  incidenciaId: string,
): Promise<IncidenciaCusto[]> {
  const { data, error } = await supabaseAdmin()
    .from("incidencia_custos")
    .select("*")
    .eq("incidencia_id", incidenciaId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IncidenciaCusto[];
}

/** Contagens por estado (para KPIs / Hoje). */
export async function contarPorEstado(): Promise<
  Record<IncidenciaEstado, number>
> {
  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .select("estado");
  if (error) throw error;
  const base: Record<IncidenciaEstado, number> = {
    aberta: 0,
    em_curso: 0,
    bloqueada: 0,
    resolvida: 0,
    fechada: 0,
  };
  for (const row of data ?? []) {
    const e = (row as { estado: IncidenciaEstado }).estado;
    base[e] += 1;
  }
  return base;
}

/** Incidências que "ardem hoje": prioridade alta e ainda por resolver. */
export async function listArdeHoje(): Promise<IncidenciaComRelacoes[]> {
  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .select(SELECT_COM_RELACOES)
    .eq("prioridade", "alta")
    .in("estado", ["aberta", "em_curso", "bloqueada"])
    .order("aberta_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as IncidenciaComRelacoes[];
}

/** Resolvidas/fechadas nos últimos `dias` dias. */
export async function contarResolvidasDesde(dias: number): Promise<number> {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  const { count, error } = await supabaseAdmin()
    .from("incidencias")
    .select("id", { count: "exact", head: true })
    .in("estado", ["resolvida", "fechada"])
    .gte("resolvida_em", limite.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Dado um conjunto de import_refs, devolve os que já existem na base. */
export async function getImportRefsExistentes(
  refs: string[],
): Promise<Set<string>> {
  const existentes = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const bloco = refs.slice(i, i + CHUNK);
    if (bloco.length === 0) continue;
    const { data, error } = await supabaseAdmin()
      .from("incidencias")
      .select("import_ref")
      .in("import_ref", bloco);
    if (error) throw error;
    for (const r of data ?? []) {
      const v = (r as { import_ref: string | null }).import_ref;
      if (v) existentes.add(v);
    }
  }
  return existentes;
}

export type IncidenciaBase = Incidencia;
