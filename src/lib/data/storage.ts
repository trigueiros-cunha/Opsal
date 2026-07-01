import "server-only";
import { FOTOS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";

/** Signed URL para um ficheiro no bucket (1h). null se falhar. */
export async function signedUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
