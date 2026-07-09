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

export interface Contribuicao {
  receita: number;
  custoDeslocacao: number;
  custoMateriais: number;
  contribuicao: number;
}

export interface ResumoDia {
  receita: number;
  custoDia: number;
  deslocacoes: number;
  materiais: number;
  contribuicao: number;
  resultado: number;
  nIntervencoes: number;
  minutosProdutivos: number;
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

/** Contribuição de uma incidência = preço − deslocação − materiais (sem mão de obra). */
export function contribuicaoIncidencia(p: {
  deslocacaoValor: number | null | undefined;
  custosMateriais: number | null | undefined;
  precoProprietario: number | null | undefined;
}): Contribuicao {
  const receita = p.precoProprietario ?? 0;
  const custoDeslocacao = p.deslocacaoValor ?? 0;
  const custoMateriais = round2(p.custosMateriais ?? 0);
  return {
    receita,
    custoDeslocacao,
    custoMateriais,
    contribuicao: round2(receita - custoDeslocacao - custoMateriais),
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

/** Agrega o dia de um técnico: resultado = Σ contribuição − custo do dia (fixo). */
export function resumoTecnicoDia(
  itens: { contrib: Contribuicao; tempoMinutos: number | null }[],
  cfg: { horasDiaPadrao: number; custoHoraCarregado: number },
): ResumoDia {
  const receita = round2(itens.reduce((a, it) => a + it.contrib.receita, 0));
  const deslocacoes = round2(
    itens.reduce((a, it) => a + it.contrib.custoDeslocacao, 0),
  );
  const materiais = round2(
    itens.reduce((a, it) => a + it.contrib.custoMateriais, 0),
  );
  const contribuicao = round2(
    itens.reduce((a, it) => a + it.contrib.contribuicao, 0),
  );
  const minutosProdutivos = itens.reduce(
    (a, it) => a + (it.tempoMinutos ?? 0),
    0,
  );
  const custoDia = round2(cfg.horasDiaPadrao * cfg.custoHoraCarregado);
  return {
    receita,
    custoDia,
    deslocacoes,
    materiais,
    contribuicao,
    resultado: round2(contribuicao - custoDia),
    nIntervencoes: itens.length,
    minutosProdutivos,
    ocupacaoPct:
      cfg.horasDiaPadrao > 0
        ? Math.round((minutosProdutivos / 60 / cfg.horasDiaPadrao) * 100)
        : 0,
    breakEvenPct:
      custoDia > 0 ? Math.round((contribuicao / custoDia) * 100) : 0,
  };
}
