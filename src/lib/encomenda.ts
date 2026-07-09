import { totalLinha } from "@/lib/format";

/** Total de uma encomenda = Σ dos totais de linha (cada linha arredondada a 2 casas). */
export function totalEncomenda(
  linhas: { quantidade: number; valor_unitario: number }[],
): number {
  const total = linhas.reduce(
    (acc, l) => acc + totalLinha(l.quantidade, l.valor_unitario),
    0,
  );
  return Math.round(total * 100) / 100;
}
