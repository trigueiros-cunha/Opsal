import type { Prioridade } from "@/lib/types";

const ALTA = [
  /fuga/i,
  /inunda/i,
  /sem luz/i,
  /sem energia/i,
  /sem [aá]gua/i,
  /sem internet/i,
  /sem wifi/i,
  /g[aá]s/i,
  /fumo/i,
  /cheiro a queimado/i,
  /n[aã]o tranca/i,
  /seguran[cç]a/i,
];
const BAIXA = [/est[eé]tic/i, /l[aâ]mpada/i, /pilha/i, /quando puder/i, /sem pressa/i];

export function prioridadePorPalavrasChave(texto: string): Prioridade {
  if (ALTA.some((r) => r.test(texto))) return "alta";
  if (BAIXA.some((r) => r.test(texto))) return "baixa";
  return "media";
}

export function tituloCurto(
  problema: string,
  maxPalavras = 8,
  maxChars = 80,
): string {
  const limpo = problema.trim().replace(/\s+/g, " ");
  if (!limpo) return "Incidência";
  const palavras = limpo.split(" ").slice(0, maxPalavras).join(" ");
  const t = palavras.length > maxChars ? palavras.slice(0, maxChars).trim() : palavras;
  return t || "Incidência";
}
