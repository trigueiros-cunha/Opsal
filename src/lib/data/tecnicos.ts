import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Tecnico } from "@/lib/types";

export async function listTecnicos(incluirInativos = false): Promise<Tecnico[]> {
  let query = supabaseAdmin()
    .from("tecnicos")
    .select("*")
    .order("nome", { ascending: true });
  if (!incluirInativos) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Tecnico[];
}

export async function getTecnico(id: string): Promise<Tecnico | null> {
  const { data, error } = await supabaseAdmin()
    .from("tecnicos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Tecnico) ?? null;
}

/** Contagem de incidências ativas por técnico (carga). */
export async function cargaPorTecnico(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .select("tecnico_id")
    .in("estado", ["aberta", "em_curso", "bloqueada"])
    .not("tecnico_id", "is", null);
  if (error) throw error;
  const carga: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { tecnico_id: string }).tecnico_id;
    carga[id] = (carga[id] ?? 0) + 1;
  }
  return carga;
}
