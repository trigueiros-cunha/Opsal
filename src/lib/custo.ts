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

export interface PL {
  custoTempo: number;
  custoDeslocacao: number;
  custoMateriais: number;
  custoTotal: number;
  receita: number;
  rentabilidade: number;
}

export interface ResumoDia {
  receita: number;
  custoTotal: number;
  resultado: number;
  nIntervencoes: number;
  minutosProdutivos: number;
  custoFixoDia: number;
  ocupacaoPct: number;
  breakEvenPct: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Custo/hora com encargos (TSU/seguro) sobre o base. */
export function custoHoraCarregado(
  base: number | null | undefined,
  taxaPct: number | null | undefined,
): number {
  return round2((base ?? 0) * (1 + (taxaPct ?? 0) / 100));
}

/** P&L de uma incidência. Materiais = só linhas tipo 'material'. */
export function plIncidencia(p: {
  tempoMinutos: number | null | undefined;
  custoHoraCarregado: number | null | undefined;
  deslocacaoValor: number | null | undefined;
  custosMateriais: number | null | undefined;
  precoProprietario: number | null | undefined;
}): PL {
  const custoTempo = maoDeObra(p.tempoMinutos, p.custoHoraCarregado) ?? 0;
  const custoDeslocacao = p.deslocacaoValor ?? 0;
  const custoMateriais = round2(p.custosMateriais ?? 0);
  const custoTotal = round2(custoTempo + custoDeslocacao + custoMateriais);
  const receita = p.precoProprietario ?? 0;
  return {
    custoTempo,
    custoDeslocacao,
    custoMateriais,
    custoTotal,
    receita,
    rentabilidade: round2(receita - custoTotal),
  };
}

/** P&L de uma obra. Custo = Σ projeto_custos; receita = orçamento. */
export function plProjeto(p: {
  custos: number | null | undefined;
  orcamentoValor: number | null | undefined;
}): PL {
  const custoTotal = round2(p.custos ?? 0);
  const receita = p.orcamentoValor ?? 0;
  return {
    custoTempo: 0,
    custoDeslocacao: 0,
    custoMateriais: custoTotal,
    custoTotal,
    receita,
    rentabilidade: round2(receita - custoTotal),
  };
}

/** Agrega os P&L de um técnico num dia (ocupação, break-even).
 *  `custoHoraCarregado` é o do técnico do grupo. */
export function resumoTecnicoDia(
  itens: { pl: PL; tempoMinutos: number | null }[],
  cfg: { horasDiaPadrao: number; custoHoraCarregado: number },
): ResumoDia {
  const receita = round2(itens.reduce((a, it) => a + it.pl.receita, 0));
  const custoTotal = round2(itens.reduce((a, it) => a + it.pl.custoTotal, 0));
  const minutosProdutivos = itens.reduce(
    (a, it) => a + (it.tempoMinutos ?? 0),
    0,
  );
  const custoFixoDia = round2(cfg.horasDiaPadrao * cfg.custoHoraCarregado);
  return {
    receita,
    custoTotal,
    resultado: round2(receita - custoTotal),
    nIntervencoes: itens.length,
    minutosProdutivos,
    custoFixoDia,
    ocupacaoPct:
      cfg.horasDiaPadrao > 0
        ? Math.round((minutosProdutivos / 60 / cfg.horasDiaPadrao) * 100)
        : 0,
    breakEvenPct:
      custoFixoDia > 0 ? Math.round((receita / custoFixoDia) * 100) : 0,
  };
}
