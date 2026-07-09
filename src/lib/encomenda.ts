/** Total de uma encomenda = Σ (quantidade × valor_unitario) das linhas. */
export function totalEncomenda(
  linhas: { quantidade: number; valor_unitario: number }[],
): number {
  const total = linhas.reduce(
    (acc, l) => acc + l.quantidade * l.valor_unitario,
    0,
  );
  return Math.round(total * 100) / 100;
}
