import "server-only";
import { FOTOS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import type { Foto } from "@/lib/types";

export interface FotoComUrl extends Foto {
  url: string | null;
}

async function comSignedUrls(fotos: Foto[]): Promise<FotoComUrl[]> {
  if (fotos.length === 0) return [];
  const paths = fotos.map((f) => f.storage_path);
  const { data, error } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .createSignedUrls(paths, 60 * 60); // 1h
  if (error) {
    // Storage pode não estar configurado ainda — degradar sem quebrar a página.
    return fotos.map((f) => ({ ...f, url: null }));
  }
  const urlPorPath = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urlPorPath.set(item.path, item.signedUrl);
  }
  return fotos.map((f) => ({ ...f, url: urlPorPath.get(f.storage_path) ?? null }));
}

export async function listFotosIncidencia(
  incidenciaId: string,
): Promise<FotoComUrl[]> {
  const { data, error } = await supabaseAdmin()
    .from("fotos")
    .select("*")
    .eq("incidencia_id", incidenciaId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return comSignedUrls((data ?? []) as Foto[]);
}

export async function listFotosProjeto(
  projetoId: string,
): Promise<FotoComUrl[]> {
  const { data, error } = await supabaseAdmin()
    .from("fotos")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return comSignedUrls((data ?? []) as Foto[]);
}
