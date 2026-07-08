export function maoDeObra(
  tempoMinutos: number | null | undefined,
  custoHora: number | null | undefined,
): number | null {
  if (!tempoMinutos || tempoMinutos <= 0) return null;
  if (!custoHora || custoHora <= 0) return null;
  return Math.round((tempoMinutos / 60) * custoHora * 100) / 100;
}

export function totalIncidencia(p: {
  custos: number;
  maoDeObra: number | null;
  deslocacaoValor: number | null | undefined;
}): number {
  const total = p.custos + (p.maoDeObra ?? 0) + (p.deslocacaoValor ?? 0);
  return Math.round(total * 100) / 100;
}

export function formatarTempo(tempoMinutos: number | null | undefined): string {
  if (!tempoMinutos || tempoMinutos <= 0) return "";
  const h = Math.floor(tempoMinutos / 60);
  const m = tempoMinutos % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
