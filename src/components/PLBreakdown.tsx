import { formatEuro } from "@/lib/format";
import type { PL, Contribuicao } from "@/lib/custo";

export function PLBreakdown({ pl, semPreco }: { pl: PL; semPreco?: boolean }) {
  const positivo = pl.rentabilidade >= 0;
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Rentabilidade</h3>
      <dl className="space-y-1.5 text-sm">
        <Linha rotulo="Receita" valor={pl.receita} />
        {semPreco ? (
          <p className="text-xs text-amber-600">Preço por definir.</p>
        ) : null}
        <Linha rotulo="− Mão de obra" valor={-pl.custoTempo} />
        <Linha rotulo="− Deslocação" valor={-pl.custoDeslocacao} />
        <Linha rotulo="− Materiais" valor={-pl.custoMateriais} />
        <div className="my-2 border-t border-slate-100" />
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-slate-800">Resultado</dt>
          <dd
            className={`text-lg font-bold ${positivo ? "text-emerald-600" : "text-red-600"}`}
          >
            {formatEuro(pl.rentabilidade)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function ContribBreakdown({
  contrib,
  semPreco,
}: {
  contrib: Contribuicao;
  semPreco?: boolean;
}) {
  const positivo = contrib.contribuicao >= 0;
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Rentabilidade</h3>
      <dl className="space-y-1.5 text-sm">
        <Linha rotulo="Receita" valor={contrib.receita} />
        {semPreco ? (
          <p className="text-xs text-amber-600">Preço por definir.</p>
        ) : null}
        <Linha rotulo="− Deslocação" valor={-contrib.custoDeslocacao} />
        <Linha rotulo="− Materiais" valor={-contrib.custoMateriais} />
        <div className="my-2 border-t border-slate-100" />
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-slate-800">Contribuição</dt>
          <dd
            className={`text-lg font-bold ${positivo ? "text-emerald-600" : "text-red-600"}`}
          >
            {formatEuro(contrib.contribuicao)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">
        A mão de obra do técnico é contada no dia — vê a página Rentabilidade.
      </p>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <dt>{rotulo}</dt>
      <dd className="font-mono">{formatEuro(valor)}</dd>
    </div>
  );
}
