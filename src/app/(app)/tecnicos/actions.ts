"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOuNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function especialidades(v: FormDataEntryValue | null): string[] {
  return str(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function criarTecnico(formData: FormData) {
  await exigirSessao();
  const nome = str(formData.get("nome"));
  const iniciais = str(formData.get("iniciais"));
  if (!nome || !iniciais) throw new Error("Nome e iniciais obrigatórios.");
  const { error } = await supabaseAdmin().from("tecnicos").insert({
    nome,
    iniciais: iniciais.toUpperCase().slice(0, 3),
    especialidades: especialidades(formData.get("especialidades")),
    contacto: strOuNull(formData.get("contacto")),
    custo_hora: num(formData.get("custo_hora")),
  });
  if (error) throw error;
  revalidatePath("/tecnicos");
}

export async function atualizarTecnico(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  const { error } = await supabaseAdmin()
    .from("tecnicos")
    .update({
      nome: str(formData.get("nome")),
      iniciais: str(formData.get("iniciais")).toUpperCase().slice(0, 3),
      especialidades: especialidades(formData.get("especialidades")),
      contacto: strOuNull(formData.get("contacto")),
      custo_hora: num(formData.get("custo_hora")),
      ativo: str(formData.get("ativo")) !== "false",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/tecnicos");
}

export async function alternarAtivoTecnico(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const ativo = str(formData.get("ativo")) === "true";
  const { error } = await supabaseAdmin()
    .from("tecnicos")
    .update({ ativo: !ativo })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/tecnicos");
}
