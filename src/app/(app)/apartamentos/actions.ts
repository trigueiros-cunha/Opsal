"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import type { Regiao } from "@/lib/types";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOuNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

export async function criarApartamento(formData: FormData) {
  await exigirSessao();
  const codigo = str(formData.get("codigo")).toUpperCase();
  const regiao = str(formData.get("regiao")) as Regiao;
  if (!codigo || !regiao) throw new Error("Código e região obrigatórios.");
  const { error } = await supabaseAdmin().from("apartamentos").insert({
    codigo,
    regiao,
    descricao: strOuNull(formData.get("descricao")),
  });
  if (error) throw error;
  revalidatePath("/apartamentos");
}

export async function atualizarApartamento(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  const { error } = await supabaseAdmin()
    .from("apartamentos")
    .update({
      codigo: str(formData.get("codigo")).toUpperCase(),
      regiao: str(formData.get("regiao")) as Regiao,
      descricao: strOuNull(formData.get("descricao")),
      ativo: str(formData.get("ativo")) !== "false",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/apartamentos");
}

export async function alternarAtivoApartamento(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const ativo = str(formData.get("ativo")) === "true";
  const { error } = await supabaseAdmin()
    .from("apartamentos")
    .update({ ativo: !ativo })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/apartamentos");
}
