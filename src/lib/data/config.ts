import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Config } from "@/lib/types";

const DEFAULTS: Config = {
  id: 1,
  taxa_encargos_pct: 23.75,
  horas_dia_padrao: 8,
  moeda: "EUR",
  atualizado_em: new Date(0).toISOString(),
};

export async function getConfig(): Promise<Config> {
  const { data, error } = await supabaseAdmin()
    .from("config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data as Config) ?? DEFAULTS;
}

export async function updateConfig(patch: {
  taxa_encargos_pct?: number;
  horas_dia_padrao?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("config")
    .upsert({ id: 1, ...patch, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}
