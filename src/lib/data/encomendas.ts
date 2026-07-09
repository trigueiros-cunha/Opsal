import "server-only";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { totalEncomenda } from "@/lib/encomenda";
import type {
  EncomendaComRelacoes,
  EncomendaDestino,
  EncomendaEstado,
  EncomendaLinha,
} from "@/lib/types";

type Db = ReturnType<typeof supabaseAdmin>;

/** Remove o ficheiro de fatura atual do storage (se houver). */
async function limparFaturaStorage(db: Db, id: string): Promise<void> {
  const { data, error } = await db
    .from("encomendas")
    .select("fatura_ficheiro")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const path = (data as { fatura_ficheiro: string | null } | null)
    ?.fatura_ficheiro;
  if (path) await db.storage.from(FOTOS_BUCKET).remove([path]);
}

const SELECT_LISTA = `
  *,
  apartamento:apartamentos ( id, codigo, regiao ),
  linhas:encomenda_linhas ( quantidade, valor_unitario )
`;

interface LinhaMin {
  quantidade: number;
  valor_unitario: number;
}

function comTotal(row: Record<string, unknown>): EncomendaComRelacoes {
  const linhas = (row.linhas as LinhaMin[] | null) ?? [];
  const enc: Record<string, unknown> = { ...row, total: totalEncomenda(linhas) };
  delete enc.linhas; // remove a prop embebida (só serve para o total)
  return enc as unknown as EncomendaComRelacoes;
}

export async function listEncomendas(filtros?: {
  destino?: EncomendaDestino;
  estado?: EncomendaEstado;
}): Promise<EncomendaComRelacoes[]> {
  let query = supabaseAdmin()
    .from("encomendas")
    .select(SELECT_LISTA)
    .order("data_encomenda", { ascending: false });
  if (filtros?.destino) query = query.eq("destino", filtros.destino);
  if (filtros?.estado) query = query.eq("estado", filtros.estado);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => comTotal(r as Record<string, unknown>));
}

export async function getEncomenda(
  id: string,
): Promise<EncomendaComRelacoes | null> {
  const { data, error } = await supabaseAdmin()
    .from("encomendas")
    .select(SELECT_LISTA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return comTotal(data as Record<string, unknown>);
}

export async function listLinhas(
  encomendaId: string,
): Promise<EncomendaLinha[]> {
  const { data, error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .select("*")
    .eq("encomenda_id", encomendaId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EncomendaLinha[];
}

export interface EncomendaInput {
  titulo?: string | null;
  destino: EncomendaDestino;
  apartamento_id?: string | null;
  fornecedor?: string | null;
  data_encomenda?: string | null;
  estado?: EncomendaEstado;
  data_rececao?: string | null;
  pagamento?: "por_pagar" | "pago";
  metodo_pagamento?: string | null;
  notas?: string | null;
}

export async function criarEncomenda(input: EncomendaInput): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("encomendas")
    .insert({
      titulo: input.titulo ?? null,
      destino: input.destino,
      apartamento_id: input.apartamento_id ?? null,
      fornecedor: input.fornecedor ?? null,
      data_encomenda: input.data_encomenda ?? undefined,
      estado: input.estado ?? undefined,
      data_rececao: input.data_rececao ?? null,
      pagamento: input.pagamento ?? undefined,
      metodo_pagamento: input.metodo_pagamento ?? null,
      notas: input.notas ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function atualizarEncomenda(
  id: string,
  patch: EncomendaInput,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomendas")
    .update({
      titulo: patch.titulo ?? null,
      destino: patch.destino,
      apartamento_id: patch.apartamento_id ?? null,
      fornecedor: patch.fornecedor ?? null,
      data_encomenda: patch.data_encomenda ?? undefined,
      estado: patch.estado ?? undefined,
      data_rececao: patch.data_rececao ?? null,
      pagamento: patch.pagamento ?? undefined,
      metodo_pagamento: patch.metodo_pagamento ?? null,
      notas: patch.notas ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function apagarEncomenda(id: string): Promise<void> {
  const db = supabaseAdmin();
  await limparFaturaStorage(db, id);
  const { error } = await db.from("encomendas").delete().eq("id", id);
  if (error) throw error;
}

export async function adicionarLinha(
  encomendaId: string,
  linha: { descricao: string; quantidade: number; valor_unitario: number },
): Promise<void> {
  const { error } = await supabaseAdmin().from("encomenda_linhas").insert({
    encomenda_id: encomendaId,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    valor_unitario: linha.valor_unitario,
  });
  if (error) throw error;
}

export async function atualizarLinha(
  id: string,
  patch: { descricao: string; quantidade: number; valor_unitario: number },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function removerLinha(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function definirFatura(id: string, path: string): Promise<void> {
  const db = supabaseAdmin();
  await limparFaturaStorage(db, id);
  const { error } = await db
    .from("encomendas")
    .update({ fatura_ficheiro: path })
    .eq("id", id);
  if (error) throw error;
}

export async function removerFatura(id: string): Promise<void> {
  const db = supabaseAdmin();
  await limparFaturaStorage(db, id);
  const { error } = await db
    .from("encomendas")
    .update({ fatura_ficheiro: null })
    .eq("id", id);
  if (error) throw error;
}
