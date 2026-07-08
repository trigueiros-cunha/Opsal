import { formatarTempo, maoDeObra, totalIncidencia } from "./custo";

export interface RegistoInput {
  notasResolucao: string | null;
  tempoMinutos: number | null;
  deslocacaoModo: string | null;
  deslocacaoValor: number | null;
  custos: { descricao: string; quantidade: number; valor_unitario: number }[];
  tecnico: { nome: string; iniciais: string; custo_hora: number } | null;
}

export interface Registo {
  resolucao: string;
  custos: string;
  outros: string;
  total: string;
  tudo: string;
}

function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}€`;
}

export function construirRegisto(input: RegistoInput): Registo {
  const resolucao = (input.notasResolucao ?? "").trim();

  // Campo 2 — faturas e custos (sem IVA).
  const custos = input.custos
    .map((c) => {
      const total = Math.round(c.quantidade * c.valor_unitario * 100) / 100;
      return `${c.descricao} — ${c.quantidade} x ${eur(c.valor_unitario)} = ${eur(total)}`;
    })
    .join("\n");

  // Campo 3 — outros custos sem fatura (deslocação + tempo), em frase.
  const partes: string[] = [];
  if (input.deslocacaoModo && input.deslocacaoModo.trim()) {
    const v = input.deslocacaoValor;
    partes.push(
      `Deslocação em ${input.deslocacaoModo.trim()}${v ? ` (${eur(v)})` : ""}.`,
    );
  }
  const tempo = formatarTempo(input.tempoMinutos);
  if (tempo) {
    partes.push(
      input.tecnico
        ? `${input.tecnico.iniciais} dedicou ${tempo} no local a resolver o problema.`
        : `Trabalho no local: ${tempo}.`,
    );
  }
  const outros = partes.join(" ");

  // Campo 4 — custo estimado (total).
  const somaCustos = input.custos.reduce(
    (a, c) => a + c.quantidade * c.valor_unitario,
    0,
  );
  const mo = maoDeObra(input.tempoMinutos, input.tecnico?.custo_hora ?? null);
  const total = totalIncidencia({
    custos: somaCustos,
    maoDeObra: mo,
    deslocacaoValor: input.deslocacaoValor,
  }).toFixed(2);

  const tudo = [
    `Como foi resolvido:\n${resolucao}`,
    `Faturas e custos (sem IVA):\n${custos}`,
    `Outros custos (sem fatura):\n${outros}`,
    `Custo estimado: ${total}`,
  ].join("\n\n");

  return { resolucao, custos, outros, total, tudo };
}
