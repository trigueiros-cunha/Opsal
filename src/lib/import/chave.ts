import { createHash } from "node:crypto";

export function normalizarCasa(casa: string): string {
  return casa.trim().toUpperCase();
}

export function normalizarProblema(problema: string): string {
  return problema.trim().replace(/\s+/g, " ");
}

function montarIso(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null; // data impossível (ex.: 31/02)
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Converte várias formas de data para "YYYY-MM-DD"; null se não reconhecer.
 * Aceita: ISO (YYYY-MM-DD), DD/MM/YYYY (também com - ou . e ano de 2 dígitos),
 * número de série do Excel, e ignora componente de hora agarrado. \s cobre
 * espaços normais e não-quebráveis (U+00A0).
 */
export function dataParaIso(data: string): string | null {
  const s0 = (data ?? "").replace(/\s+/g, " ").trim();
  if (!s0) return null;
  const s = s0.split(" ")[0].trim(); // largar hora ("02/07/2026 00:00")
  if (!s) return null;

  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return montarIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // Dia primeiro (PT): DD/MM/YYYY, com / - . e ano de 2 ou 4 dígitos
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let ano = Number(m[3]);
    if (ano < 100) ano += 2000;
    return montarIso(ano, Number(m[2]), Number(m[1]));
  }

  // Número de série do Excel (ex.: 46205 = 2026-07-02; ignora fração de hora).
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial >= 20000 && serial <= 90000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return montarIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }

  return null;
}

export function calcularImportRef(
  casa: string,
  dataIso: string,
  problema: string,
): string {
  const base = `${normalizarCasa(casa)}|${dataIso}|${normalizarProblema(problema)}`;
  return createHash("sha256").update(base).digest("hex");
}
