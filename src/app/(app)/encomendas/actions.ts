"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import * as dataEnc from "@/lib/data/encomendas";
import * as dataLista from "@/lib/data/lista_compras";
import type { EncomendaDestino, EncomendaEstado } from "@/lib/types";

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

function lerCabecalho(formData: FormData): dataEnc.EncomendaInput {
  return {
    titulo: strOuNull(formData.get("titulo")),
    destino: (str(formData.get("destino")) || "consumo") as EncomendaDestino,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    fornecedor: strOuNull(formData.get("fornecedor")),
    data_encomenda: strOuNull(formData.get("data_encomenda")),
    estado: (str(formData.get("estado")) || "encomendada") as EncomendaEstado,
    data_rececao: strOuNull(formData.get("data_rececao")),
    pagamento: str(formData.get("pagamento")) === "pago" ? "pago" : "por_pagar",
    metodo_pagamento: strOuNull(formData.get("metodo_pagamento")),
    notas: strOuNull(formData.get("notas")),
  };
}

// ── Encomenda (cabeçalho) ─────────────────────────────────────────────────────
export async function criarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = await dataEnc.criarEncomenda(lerCabecalho(formData));
  revalidatePath("/encomendas");
  redirect(`/encomendas/${id}`);
}

export async function atualizarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.atualizarEncomenda(id, lerCabecalho(formData));
  revalidatePath(`/encomendas/${id}`);
  revalidatePath("/encomendas");
}

export async function apagarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.apagarEncomenda(id);
  revalidatePath("/encomendas");
  redirect("/encomendas");
}

// ── Linhas ────────────────────────────────────────────────────────────────────
export async function adicionarLinha(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  if (!encomendaId) throw new Error("encomenda_id em falta");
  await dataEnc.adicionarLinha(encomendaId, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    valor_unitario: num(formData.get("valor_unitario")),
  });
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function atualizarLinha(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const encomendaId = str(formData.get("encomenda_id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.atualizarLinha(id, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")),
    valor_unitario: num(formData.get("valor_unitario")),
  });
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function removerLinha(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const encomendaId = str(formData.get("encomenda_id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.removerLinha(id);
  revalidatePath(`/encomendas/${encomendaId}`);
}

// ── Fatura ────────────────────────────────────────────────────────────────────
export async function uploadFatura(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  const file = formData.get("file");
  if (!encomendaId || !(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const ext = file.name.split(".").pop() || "pdf";
  const path = `encomendas/${encomendaId}/fatura-${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: errUp } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/pdf" });
  if (errUp) throw errUp;
  await dataEnc.definirFatura(encomendaId, path);
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function removerFatura(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  if (!encomendaId) throw new Error("encomenda_id em falta");
  await dataEnc.removerFatura(encomendaId);
  revalidatePath(`/encomendas/${encomendaId}`);
}

// ── Lista de compras ──────────────────────────────────────────────────────────
export async function adicionarItemLista(formData: FormData) {
  await exigirSessao();
  const descricao = str(formData.get("descricao"));
  if (!descricao) throw new Error("Descrição em falta.");
  await dataLista.adicionarItem({
    descricao,
    quantidade: num(formData.get("quantidade")) || 1,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    notas: strOuNull(formData.get("notas")),
  });
  revalidatePath("/encomendas");
}

export async function atualizarItemLista(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataLista.atualizarItem(id, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    notas: strOuNull(formData.get("notas")),
  });
  revalidatePath("/encomendas");
}

export async function removerItemLista(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataLista.removerItem(id);
  revalidatePath("/encomendas");
}

export async function criarEncomendaDeItens(formData: FormData) {
  await exigirSessao();
  const itemIds = formData.getAll("itemIds").map((v) => String(v));
  if (itemIds.length === 0) throw new Error("Sem itens selecionados.");
  const id = await dataLista.converterEmEncomenda(itemIds, {
    destino: (str(formData.get("destino")) || "consumo") as EncomendaDestino,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
  });
  revalidatePath("/encomendas");
  redirect(`/encomendas/${id}`);
}
