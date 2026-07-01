import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Apartamento, Regiao } from "@/lib/types";

export async function listApartamentos(opts?: {
  regiao?: Regiao;
  q?: string;
  incluirInativos?: boolean;
}): Promise<Apartamento[]> {
  let query = supabaseAdmin()
    .from("apartamentos")
    .select("*")
    .order("codigo", { ascending: true });

  if (!opts?.incluirInativos) query = query.eq("ativo", true);
  if (opts?.regiao) query = query.eq("regiao", opts.regiao);
  if (opts?.q) {
    const termo = opts.q.trim();
    query = query.or(`codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Apartamento[];
}

/** Apartamentos ativos, minimal, para seletores. */
export async function listApartamentosSelect(): Promise<
  Pick<Apartamento, "id" | "codigo" | "regiao">[]
> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("id, codigo, regiao")
    .eq("ativo", true)
    .order("codigo", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getApartamento(id: string): Promise<Apartamento | null> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Apartamento) ?? null;
}

export async function getApartamentoPorCodigo(
  codigo: string,
): Promise<Apartamento | null> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("*")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw error;
  return (data as Apartamento) ?? null;
}
