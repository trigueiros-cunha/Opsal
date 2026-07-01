import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RecorrenteEstado, RecorrenteTipo } from "@/lib/types";

export async function listRecorrentesEstado(opts?: {
  tipo?: RecorrenteTipo;
}): Promise<RecorrenteEstado[]> {
  let query = supabaseAdmin()
    .from("recorrentes_estado")
    .select("*")
    .order("dias_restantes", { ascending: true });
  if (opts?.tipo) query = query.eq("tipo", opts.tipo);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RecorrenteEstado[];
}

export async function getRecorrenteEstado(
  id: string,
): Promise<RecorrenteEstado | null> {
  const { data, error } = await supabaseAdmin()
    .from("recorrentes_estado")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as RecorrenteEstado) ?? null;
}

/** Recorrentes vencidas (semáforo vermelho) — para o painel Hoje. */
export async function listVencidas(): Promise<RecorrenteEstado[]> {
  const { data, error } = await supabaseAdmin()
    .from("recorrentes_estado")
    .select("*")
    .lt("dias_restantes", 0)
    .order("dias_restantes", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecorrenteEstado[];
}

/** Contagem de recorrentes a vencer ou vencidas (amarelo+vermelho). */
export async function contarAVencer(): Promise<number> {
  const linhas = await listRecorrentesEstado();
  return linhas.filter((r) => r.semaforo !== "verde").length;
}
