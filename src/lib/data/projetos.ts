import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ProjetoComRelacoes,
  ProjetoCusto,
  ProjetoFase,
} from "@/lib/types";

const SELECT_COM_RELACOES = `
  *,
  apartamento:apartamentos ( id, codigo, regiao ),
  tecnico:tecnicos ( id, nome, iniciais )
`;

export async function listProjetos(opts?: {
  fase?: ProjetoFase;
}): Promise<ProjetoComRelacoes[]> {
  let query = supabaseAdmin()
    .from("projetos")
    .select(SELECT_COM_RELACOES)
    .order("atualizado_em", { ascending: false });
  if (opts?.fase) query = query.eq("fase", opts.fase);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProjetoComRelacoes[];
}

export async function getProjeto(
  id: string,
): Promise<ProjetoComRelacoes | null> {
  const { data, error } = await supabaseAdmin()
    .from("projetos")
    .select(SELECT_COM_RELACOES)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProjetoComRelacoes) ?? null;
}

export async function listCustosProjeto(
  projetoId: string,
): Promise<ProjetoCusto[]> {
  const { data, error } = await supabaseAdmin()
    .from("projeto_custos")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjetoCusto[];
}

/** Projetos à espera de decisão do proprietário (fase 'aprovacao'). */
export async function listAguardaAprovacao(): Promise<ProjetoComRelacoes[]> {
  const { data, error } = await supabaseAdmin()
    .from("projetos")
    .select(SELECT_COM_RELACOES)
    .eq("fase", "aprovacao")
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProjetoComRelacoes[];
}

export async function contarPorFase(): Promise<Record<ProjetoFase, number>> {
  const { data, error } = await supabaseAdmin().from("projetos").select("fase");
  if (error) throw error;
  const base: Record<ProjetoFase, number> = {
    rascunho: 0,
    orcamento: 0,
    aprovacao: 0,
    execucao: 0,
    concluido: 0,
  };
  for (const row of data ?? []) base[(row as { fase: ProjetoFase }).fase] += 1;
  return base;
}
