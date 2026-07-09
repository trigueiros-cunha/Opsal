import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { criarEncomenda, adicionarLinha } from "@/lib/data/encomendas";
import type { EncomendaDestino, ListaCompraItem } from "@/lib/types";

export async function listPendentes(): Promise<ListaCompraItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("lista_compras")
    .select("*")
    .eq("comprado", false)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListaCompraItem[];
}

export async function adicionarItem(input: {
  descricao: string;
  quantidade?: number;
  apartamento_id?: string | null;
  notas?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("lista_compras").insert({
    descricao: input.descricao,
    quantidade: input.quantidade ?? 1,
    apartamento_id: input.apartamento_id ?? null,
    notas: input.notas ?? null,
  });
  if (error) throw error;
}

export async function atualizarItem(
  id: string,
  patch: {
    descricao: string;
    quantidade: number;
    apartamento_id: string | null;
    notas: string | null;
  },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("lista_compras")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function removerItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("lista_compras")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Converte itens pendentes numa única encomenda (uma linha por item). */
export async function converterEmEncomenda(
  itemIds: string[],
  header: { destino: EncomendaDestino; apartamento_id?: string | null },
): Promise<string> {
  if (itemIds.length === 0) throw new Error("Sem itens selecionados.");
  const db = supabaseAdmin();

  const { data: itens, error: errLer } = await db
    .from("lista_compras")
    .select("id, descricao, quantidade")
    .in("id", itemIds)
    .eq("comprado", false);
  if (errLer) throw errLer;
  const linhas = (itens ?? []) as {
    id: string;
    descricao: string;
    quantidade: number;
  }[];
  if (linhas.length === 0) throw new Error("Itens já convertidos.");

  const encomendaId = await criarEncomenda({
    destino: header.destino,
    apartamento_id: header.apartamento_id ?? null,
  });

  for (const l of linhas) {
    await adicionarLinha(encomendaId, {
      descricao: l.descricao,
      quantidade: l.quantidade,
      valor_unitario: 0,
    });
  }

  const { error: errUpd } = await db
    .from("lista_compras")
    .update({ comprado: true, encomenda_id: encomendaId })
    .in(
      "id",
      linhas.map((l) => l.id),
    );
  if (errUpd) throw errUpd;

  return encomendaId;
}
