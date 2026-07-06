"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import type {
  CustoTipo,
  IncidenciaEstado,
  Origem,
  Prioridade,
} from "@/lib/types";

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

// ── Criar ────────────────────────────────────────────────────────────────────
export async function criarIncidencia(formData: FormData) {
  await exigirSessao();
  const apartamento_id = str(formData.get("apartamento_id"));
  const titulo = str(formData.get("titulo"));
  if (!apartamento_id || !titulo) {
    throw new Error("Apartamento e título são obrigatórios.");
  }

  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .insert({
      apartamento_id,
      titulo,
      descricao: strOuNull(formData.get("descricao")),
      prioridade: (str(formData.get("prioridade")) || "media") as Prioridade,
      estado: (str(formData.get("estado")) || "aberta") as IncidenciaEstado,
      origem: (str(formData.get("origem")) || "hospede") as Origem,
      tecnico_id: strOuNull(formData.get("tecnico_id")),
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/incidencias");
  revalidatePath("/");
  redirect(`/incidencias/${data.id}`);
}

// Variante que aceita objeto (usada pela extração WhatsApp).
export async function criarIncidenciaObj(input: {
  apartamento_id: string;
  titulo: string;
  descricao?: string | null;
  prioridade?: Prioridade;
  origem?: Origem;
  tecnico_id?: string | null;
}): Promise<string> {
  await exigirSessao();
  if (!input.apartamento_id || !input.titulo) {
    throw new Error("Apartamento e título são obrigatórios.");
  }
  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .insert({
      apartamento_id: input.apartamento_id,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      prioridade: input.prioridade ?? "media",
      origem: input.origem ?? "hospede",
      tecnico_id: input.tecnico_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/incidencias");
  revalidatePath("/");
  return data.id as string;
}

// ── Atualizar campos gerais ──────────────────────────────────────────────────
export async function atualizarIncidencia(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");

  const patch: Record<string, unknown> = {
    titulo: str(formData.get("titulo")),
    descricao: strOuNull(formData.get("descricao")),
    prioridade: str(formData.get("prioridade")) as Prioridade,
    origem: str(formData.get("origem")) as Origem,
    tecnico_id: strOuNull(formData.get("tecnico_id")),
    apartamento_id: str(formData.get("apartamento_id")),
  };

  const { error } = await supabaseAdmin()
    .from("incidencias")
    .update(patch)
    .eq("id", id);
  if (error) throw error;

  revalidatePath(`/incidencias/${id}`);
  revalidatePath("/incidencias");
}

// ── Mudar estado (com fecho de ciclo de recorrente, secção 4) ────────────────
export async function mudarEstado(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const estado = str(formData.get("estado")) as IncidenciaEstado;
  if (!id || !estado) throw new Error("id/estado em falta");

  const db = supabaseAdmin();

  // Ler a incidência (precisamos de recorrente_id e estado anterior).
  const { data: incAtual, error: errLer } = await db
    .from("incidencias")
    .select("id, recorrente_id, resolvida_em")
    .eq("id", id)
    .single();
  if (errLer) throw errLer;

  const patch: Record<string, unknown> = {
    estado,
    bloqueada_aguarda:
      estado === "bloqueada"
        ? strOuNull(formData.get("bloqueada_aguarda"))
        : null,
  };

  const nota = strOuNull(formData.get("notas_resolucao"));
  if (nota !== null) patch.notas_resolucao = nota;

  const resolvida = estado === "resolvida" || estado === "fechada";
  const dataResolucao = new Date();
  if (resolvida) {
    // Preserva resolvida_em se já existia.
    patch.resolvida_em = incAtual.resolvida_em ?? dataResolucao.toISOString();
  } else {
    patch.resolvida_em = null;
  }

  const { error } = await db.from("incidencias").update(patch).eq("id", id);
  if (error) throw error;

  // Fecho de ciclo: se tem recorrente_id e passou a resolvida/fechada,
  // atualizar ultima_intervencao da recorrente para a data de resolução.
  if (resolvida && incAtual.recorrente_id) {
    const dataStr =
      (patch.resolvida_em as string).slice(0, 10) ??
      dataResolucao.toISOString().slice(0, 10);
    const { error: errRec } = await db
      .from("recorrentes")
      .update({ ultima_intervencao: dataStr })
      .eq("id", incAtual.recorrente_id);
    if (errRec) throw errRec;
    revalidatePath("/recorrentes");
  }

  revalidatePath(`/incidencias/${id}`);
  revalidatePath("/incidencias");
  revalidatePath("/");
}

// ── Apagar ────────────────────────────────────────────────────────────────────
export async function apagarIncidencia(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");

  const db = supabaseAdmin();

  // Limpar ficheiros do Storage; os registos de fotos/custos caem por cascade.
  const { data: fotos } = await db
    .from("fotos")
    .select("storage_path")
    .eq("incidencia_id", id);
  const paths = (fotos ?? [])
    .map((f) => (f as { storage_path: string | null }).storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await db.storage.from(FOTOS_BUCKET).remove(paths);
  }

  const { error } = await db.from("incidencias").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/incidencias");
  revalidatePath("/");
  redirect("/incidencias");
}

// ── Custos ────────────────────────────────────────────────────────────────────
export async function adicionarCusto(formData: FormData) {
  await exigirSessao();
  const incidencia_id = str(formData.get("incidencia_id"));
  if (!incidencia_id) throw new Error("incidencia_id em falta");

  const { error } = await supabaseAdmin().from("incidencia_custos").insert({
    incidencia_id,
    tipo: (str(formData.get("tipo")) || "material") as CustoTipo,
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    valor_unitario: num(formData.get("valor_unitario")),
  });
  if (error) throw error;
  revalidatePath(`/incidencias/${incidencia_id}`);
}

export async function atualizarCusto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const incidencia_id = str(formData.get("incidencia_id"));
  if (!id) throw new Error("id em falta");
  const { error } = await supabaseAdmin()
    .from("incidencia_custos")
    .update({
      tipo: str(formData.get("tipo")) as CustoTipo,
      descricao: str(formData.get("descricao")) || "—",
      quantidade: num(formData.get("quantidade")),
      valor_unitario: num(formData.get("valor_unitario")),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/incidencias/${incidencia_id}`);
}

export async function removerCusto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const incidencia_id = str(formData.get("incidencia_id"));
  const { error } = await supabaseAdmin()
    .from("incidencia_custos")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/incidencias/${incidencia_id}`);
}

// ── Fotos ─────────────────────────────────────────────────────────────────────
export async function uploadFoto(formData: FormData) {
  await exigirSessao();
  const incidencia_id = str(formData.get("incidencia_id"));
  const file = formData.get("file");
  if (!incidencia_id || !(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `incidencias/${incidencia_id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: errUp } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "image/jpeg" });
  if (errUp) throw errUp;

  const { error } = await supabaseAdmin()
    .from("fotos")
    .insert({ incidencia_id, storage_path: path });
  if (error) throw error;
  revalidatePath(`/incidencias/${incidencia_id}`);
}

export async function removerFoto(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const incidencia_id = str(formData.get("incidencia_id"));
  const path = str(formData.get("storage_path"));
  if (path) {
    await supabaseAdmin().storage.from(FOTOS_BUCKET).remove([path]);
  }
  const { error } = await supabaseAdmin().from("fotos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/incidencias/${incidencia_id}`);
}
