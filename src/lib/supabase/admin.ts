import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Cliente Supabase server-side (service_role) ──────────────────────────────
// Single-user: não há RLS por utilizador. A service_role key NUNCA pode chegar
// ao cliente — este módulo importa "server-only" para garantir isso em build.
//
// Toda a escrita/leitura de dados passa por route handlers, server actions ou
// server components que usam este cliente.

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase por configurar: definir NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** true se as variáveis Supabase estão presentes (para estados vazios úteis). */
export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export const FOTOS_BUCKET = "manutencao-fotos";
