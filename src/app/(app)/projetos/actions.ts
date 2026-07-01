"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import type { CustoTipo, ProjetoFase } from "@/lib/types";

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
function numOuNull(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function criarProjeto(formData: FormData) {
  await exigirSessao();
  const apartamento_id = str(formData.get("apartamento_id"));
  const titulo = str(formData.get("titulo"));
  if (!apartamento_id || !titulo) {
    throw new Error("Apartamento e título são obrigatórios.");
  }
  const { data, error } = await supabaseAdmin()
    .from("projetos")
    .insert({
      apartamento_id,
      titulo,
      descricao: strOuNull(formData.get("descricao")),
      proprietario_nome: strOuNull(formData.get("proprietario_nome")),
      fase: (str(formData.get("fase")) || "rascunho") as ProjetoFase,
      orcamento_valor: numOuNull(formData.get("orcamento_valor")),
      tecnico_id: strOuNull(formData.get("tecnico_id")),
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/projetos");
  revalidatePath("/");
  redirect(`/projetos/${data.id}`);
}

export async function atualizarProjeto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  const { error } = await supabaseAdmin()
    .from("projetos")
    .update({
      apartamento_id: str(formData.get("apartamento_id")),
      titulo: str(formData.get("titulo")),
      descricao: strOuNull(formData.get("descricao")),
      proprietario_nome: strOuNull(formData.get("proprietario_nome")),
      fase: str(formData.get("fase")) as ProjetoFase,
      orcamento_valor: numOuNull(formData.get("orcamento_valor")),
      tecnico_id: strOuNull(formData.get("tecnico_id")),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
  revalidatePath("/");
}

/** Mudar apenas a fase (botões rápidos). */
export async function mudarFase(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const fase = str(formData.get("fase")) as ProjetoFase;
  if (!id || !fase) throw new Error("id/fase em falta");
  const { error } = await supabaseAdmin()
    .from("projetos")
    .update({ fase })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
  revalidatePath("/");
}

/** Registo manual da aprovação do proprietário (secção 5 / decisões). */
export async function registarAprovacao(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  const aprovado_em = str(formData.get("aprovado_em")) || null;
  const { error } = await supabaseAdmin()
    .from("projetos")
    .update({
      aprovado_em,
      aprovado_nota: strOuNull(formData.get("aprovado_nota")),
      // Aprovar move para execução (mantém-se editável).
      fase: aprovado_em ? "execucao" : "aprovacao",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${id}`);
  revalidatePath("/projetos");
  revalidatePath("/");
}

// ── Custos de projeto ─────────────────────────────────────────────────────────
export async function adicionarCustoProjeto(formData: FormData) {
  await exigirSessao();
  const projeto_id = str(formData.get("projeto_id"));
  if (!projeto_id) throw new Error("projeto_id em falta");
  const { error } = await supabaseAdmin().from("projeto_custos").insert({
    projeto_id,
    tipo: (str(formData.get("tipo")) || "material") as CustoTipo,
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    valor_unitario: num(formData.get("valor_unitario")),
  });
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}

export async function atualizarCustoProjeto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const projeto_id = str(formData.get("projeto_id"));
  const { error } = await supabaseAdmin()
    .from("projeto_custos")
    .update({
      tipo: str(formData.get("tipo")) as CustoTipo,
      descricao: str(formData.get("descricao")) || "—",
      quantidade: num(formData.get("quantidade")),
      valor_unitario: num(formData.get("valor_unitario")),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}

export async function removerCustoProjeto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const projeto_id = str(formData.get("projeto_id"));
  const { error } = await supabaseAdmin()
    .from("projeto_custos")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}

// ── Orçamento (PDF) ───────────────────────────────────────────────────────────
export async function uploadOrcamento(formData: FormData) {
  await exigirSessao();
  const projeto_id = str(formData.get("projeto_id"));
  const file = formData.get("file");
  if (!projeto_id || !(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const path = `projetos/${projeto_id}/orcamento-${crypto.randomUUID()}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: errUp } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/pdf" });
  if (errUp) throw errUp;
  const { error } = await supabaseAdmin()
    .from("projetos")
    .update({ orcamento_ficheiro: path })
    .eq("id", projeto_id);
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}

// ── Fotos de projeto ──────────────────────────────────────────────────────────
export async function uploadFotoProjeto(formData: FormData) {
  await exigirSessao();
  const projeto_id = str(formData.get("projeto_id"));
  const file = formData.get("file");
  if (!projeto_id || !(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `projetos/${projeto_id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: errUp } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "image/jpeg" });
  if (errUp) throw errUp;
  const { error } = await supabaseAdmin()
    .from("fotos")
    .insert({ projeto_id, storage_path: path });
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}

export async function removerFotoProjeto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const projeto_id = str(formData.get("projeto_id"));
  const path = str(formData.get("storage_path"));
  if (path) await supabaseAdmin().storage.from(FOTOS_BUCKET).remove([path]);
  const { error } = await supabaseAdmin().from("fotos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/projetos/${projeto_id}`);
}
