"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import { getImportRefsExistentes } from "@/lib/data/incidencias";
import { parseFicheiro } from "@/lib/import/parseXlsx";
import { mapearLinha } from "@/lib/import/mapearLinha";
import { extrairTituloPrioridade } from "@/lib/import/extrairTitulo";
import type {
  CamposIncidencia,
  MapaApartamentos,
  ResultadoAnalise,
} from "@/lib/import/tipos";
import type { Regiao } from "@/lib/types";

async function mapaApartamentos(): Promise<MapaApartamentos> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("id, codigo, regiao");
  if (error) throw error;
  const mapa: MapaApartamentos = new Map();
  for (const a of data ?? []) {
    const row = a as { id: string; codigo: string; regiao: Regiao };
    mapa.set(row.codigo.trim().toUpperCase(), { id: row.id, regiao: row.regiao });
  }
  return mapa;
}

export async function analisarImport(
  formData: FormData,
): Promise<ResultadoAnalise> {
  await exigirSessao();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const linhas = parseFicheiro(bytes);
  const apartamentos = await mapaApartamentos();

  // linha i+2: 1 = cabeçalho no Excel.
  const mapeadas = linhas.map((l, i) => mapearLinha(l, i + 2, apartamentos));

  const ok = mapeadas.flatMap((m) => (m.status === "ok" ? [m] : []));
  const erros = mapeadas
    .flatMap((m) => (m.status === "erro" ? [m] : []))
    .map((m) => ({
      linha: m.linha,
      motivo: m.motivo,
      casa: m.casa,
      problema: m.problema,
    }));

  const existentes = await getImportRefsExistentes(
    ok.map((m) => m.campos.import_ref),
  );

  const novas: CamposIncidencia[] = [];
  const vistos = new Set<string>();
  let existem = 0;
  for (const m of ok) {
    const ref = m.campos.import_ref;
    if (existentes.has(ref) || vistos.has(ref)) {
      existem += 1;
      continue;
    }
    vistos.add(ref);
    novas.push(m.campos);
  }

  return { novas, existem, erros, total: linhas.length };
}

async function comConcorrencia<T, R>(
  itens: T[],
  limite: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const res: R[] = new Array(itens.length);
  let i = 0;
  async function worker() {
    while (i < itens.length) {
      const idx = i++;
      res[idx] = await fn(itens[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, () => worker()),
  );
  return res;
}

export async function importarLote(
  campos: CamposIncidencia[],
): Promise<{ inseridas: number }> {
  await exigirSessao();
  if (campos.length === 0) return { inseridas: 0 };

  const comIa = await comConcorrencia(campos, 5, async (c) => {
    const { titulo, prioridade } = await extrairTituloPrioridade(c.problema);
    return { ...c, titulo, prioridade };
  });

  const rows = comIa.map((c) => ({
    apartamento_id: c.apartamento_id,
    titulo: c.titulo,
    descricao: c.descricao,
    prioridade: c.prioridade,
    estado: c.estado,
    origem: c.origem,
    aberta_em: c.aberta_em,
    resolvida_em: c.resolvida_em,
    import_ref: c.import_ref,
  }));

  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .upsert(rows, { onConflict: "import_ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  revalidatePath("/incidencias");
  revalidatePath("/");
  return { inseridas: data?.length ?? 0 };
}
