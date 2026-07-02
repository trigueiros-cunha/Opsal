import { createHash } from "node:crypto";

export function normalizarCasa(casa: string): string {
  return casa.trim().toUpperCase();
}

export function normalizarProblema(problema: string): string {
  return problema.trim().replace(/\s+/g, " ");
}

/** "DD/MM/YYYY" (ou "D/M/YYYY") → "YYYY-MM-DD"; null se inválida. */
export function dataParaIso(data: string): string | null {
  const m = data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
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

export function calcularImportRef(
  casa: string,
  dataIso: string,
  problema: string,
): string {
  const base = `${normalizarCasa(casa)}|${dataIso}|${normalizarProblema(problema)}`;
  return createHash("sha256").update(base).digest("hex");
}
