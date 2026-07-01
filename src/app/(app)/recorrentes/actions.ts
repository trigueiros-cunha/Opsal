"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import { RECORRENTE_TITULO } from "@/lib/constants";
import type { RecorrenteTipo } from "@/lib/types";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOuNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function int(v: FormDataEntryValue | null, fallback = 0): number {
  const n = parseInt(str(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function criarRecorrente(formData: FormData) {
  await exigirSessao();
  const apartamento_id = str(formData.get("apartamento_id"));
  const tipo = str(formData.get("tipo")) as RecorrenteTipo;
  const ciclo_meses = int(formData.get("ciclo_meses"));
  const ultima_intervencao = str(formData.get("ultima_intervencao"));
  if (!apartamento_id || !tipo || !ciclo_meses || !ultima_intervencao) {
    throw new Error("Campos obrigatórios em falta.");
  }

  const { error } = await supabaseAdmin().from("recorrentes").insert({
    apartamento_id,
    tipo,
    ciclo_meses,
    ultima_intervencao,
    aviso_previo_dias: int(formData.get("aviso_previo_dias"), 15),
    tecnico_habitual_id: strOuNull(formData.get("tecnico_habitual_id")),
  });
  if (error) throw error;
  revalidatePath("/recorrentes");
  redirect("/recorrentes");
}

export async function atualizarRecorrente(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  const { error } = await supabaseAdmin()
    .from("recorrentes")
    .update({
      apartamento_id: str(formData.get("apartamento_id")),
      tipo: str(formData.get("tipo")) as RecorrenteTipo,
      ciclo_meses: int(formData.get("ciclo_meses")),
      ultima_intervencao: str(formData.get("ultima_intervencao")),
      aviso_previo_dias: int(formData.get("aviso_previo_dias"), 15),
      tecnico_habitual_id: strOuNull(formData.get("tecnico_habitual_id")),
      ativo: str(formData.get("ativo")) !== "false",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/recorrentes");
  redirect("/recorrentes");
}

export async function desativarRecorrente(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const { error } = await supabaseAdmin()
    .from("recorrentes")
    .update({ ativo: false })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/recorrentes");
}

// ── Gerar incidência a partir de recorrente (clique único, secção 4) ─────────
export async function gerarIncidenciaDeRecorrente(formData: FormData) {
  await exigirSessao();
  const recorrente_id = str(formData.get("recorrente_id"));
  if (!recorrente_id) throw new Error("recorrente_id em falta");

  const db = supabaseAdmin();
  const { data: rec, error: errRec } = await db
    .from("recorrentes")
    .select("id, apartamento_id, tipo, tecnico_habitual_id")
    .eq("id", recorrente_id)
    .single();
  if (errRec) throw errRec;

  const titulo = RECORRENTE_TITULO[rec.tipo as RecorrenteTipo];

  const { data: inc, error: errInc } = await db
    .from("incidencias")
    .insert({
      apartamento_id: rec.apartamento_id,
      titulo,
      origem: "inspecao",
      tecnico_id: rec.tecnico_habitual_id,
      recorrente_id: rec.id,
    })
    .select("id")
    .single();
  if (errInc) throw errInc;

  // Opcional: pré-criar linha de mão de obra com o técnico habitual.
  if (rec.tecnico_habitual_id) {
    const { data: tec } = await db
      .from("tecnicos")
      .select("nome, custo_hora")
      .eq("id", rec.tecnico_habitual_id)
      .maybeSingle();
    if (tec) {
      await db.from("incidencia_custos").insert({
        incidencia_id: inc.id,
        tipo: "mao_obra",
        descricao: `Mão de obra — ${tec.nome}`,
        quantidade: 1,
        valor_unitario: tec.custo_hora ?? 0,
      });
    }
  }

  revalidatePath("/recorrentes");
  revalidatePath("/incidencias");
  revalidatePath("/");
  redirect(`/incidencias/${inc.id}`);
}
