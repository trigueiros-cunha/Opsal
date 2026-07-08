import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RECORRENTE_TITULO } from "@/lib/constants";
import { adicionarDias, toISODate } from "@/lib/format";
import type { EventoAgenda, RecorrenteTipo } from "@/lib/types";

// Junta incidências ativas, recorrentes cuja proxima_data cai na semana, e
// projetos em execução (simplificação MVP — secção 6).
export async function eventosDaSemana(
  inicioISO: string,
): Promise<EventoAgenda[]> {
  const inicio = new Date(inicioISO + "T00:00:00");
  const fimExclusivo = adicionarDias(inicio, 7); // 7 dias: seg→dom
  const inicioStr = toISODate(inicio);
  const fimStr = toISODate(fimExclusivo);

  const db = supabaseAdmin();
  const eventos: EventoAgenda[] = [];

  // ── Incidências ativas: agendadas na janela + não-agendadas criadas na janela.
  //    Data efetiva = COALESCE(agendada_em, aberta_em::date). ──────────────────
  const pushInc = (
    row: {
      id: string;
      titulo: string;
      tecnico_id: string | null;
      aberta_em: string;
      agendada_em: string | null;
      apartamento: { codigo: string } | null;
    },
    agendado: boolean,
  ) => {
    eventos.push({
      id: row.id,
      kind: "inc",
      apartamento_codigo: row.apartamento?.codigo ?? "—",
      titulo: row.titulo,
      tecnico_id: row.tecnico_id,
      data: row.agendada_em ?? toISODate(new Date(row.aberta_em)),
      agendado,
    });
  };

  const selectInc = `id, titulo, tecnico_id, aberta_em, agendada_em,
       apartamento:apartamentos ( codigo )`;

  // (1) Agendadas cuja agendada_em cai na semana.
  const { data: incAgendadas, error: incAgErr } = await db
    .from("incidencias")
    .select(selectInc)
    .not("estado", "in", "(resolvida,fechada)")
    .gte("agendada_em", inicioStr)
    .lt("agendada_em", fimStr);
  if (incAgErr) throw incAgErr;
  for (const i of incAgendadas ?? []) pushInc(i as never, true);

  // (2) Não-agendadas criadas na semana (comportamento legado).
  const { data: incCriadas, error: incCrErr } = await db
    .from("incidencias")
    .select(selectInc)
    .not("estado", "in", "(resolvida,fechada)")
    .is("agendada_em", null)
    .gte("aberta_em", inicio.toISOString())
    .lt("aberta_em", fimExclusivo.toISOString());
  if (incCrErr) throw incCrErr;
  for (const i of incCriadas ?? []) pushInc(i as never, false);

  // ── Recorrentes: proxima_data na janela (via view) ─────────────────────────
  const { data: recs, error: recErr } = await db
    .from("recorrentes_estado")
    .select(
      "id, tipo, tecnico_habitual_id, apartamento_codigo, proxima_data",
    )
    .gte("proxima_data", inicioStr)
    .lt("proxima_data", fimStr);
  if (recErr) throw recErr;
  for (const r of recs ?? []) {
    const row = r as unknown as {
      id: string;
      tipo: RecorrenteTipo;
      tecnico_habitual_id: string | null;
      apartamento_codigo: string;
      proxima_data: string;
    };
    eventos.push({
      id: row.id,
      kind: "rec",
      apartamento_codigo: row.apartamento_codigo,
      titulo: RECORRENTE_TITULO[row.tipo],
      tecnico_id: row.tecnico_habitual_id,
      data: row.proxima_data,
    });
  }

  // ── Projetos: em execução (marco simplificado no início da semana) ─────────
  const { data: projs, error: projErr } = await db
    .from("projetos")
    .select(
      `id, titulo, tecnico_id,
       apartamento:apartamentos ( codigo )`,
    )
    .eq("fase", "execucao");
  if (projErr) throw projErr;
  for (const p of projs ?? []) {
    const row = p as unknown as {
      id: string;
      titulo: string;
      tecnico_id: string | null;
      apartamento: { codigo: string } | null;
    };
    eventos.push({
      id: row.id,
      kind: "proj",
      apartamento_codigo: row.apartamento?.codigo ?? "—",
      titulo: row.titulo,
      tecnico_id: row.tecnico_id,
      data: inicioStr, // MVP: coloca no início da semana
    });
  }

  return eventos;
}
