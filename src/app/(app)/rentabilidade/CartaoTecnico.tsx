import { Avatar } from "@/components/ui/Avatar";
import { formatEuro, formatNumero } from "@/lib/format";
import { formatarTempo } from "@/lib/custo";
import type { ResumoTecnico } from "@/lib/data/rentabilidade";

export function CartaoTecnico({ grupo }: { grupo: ResumoTecnico }) {
  const { tecnico, resumo } = grupo;
  const positivo = resumo.resultado >= 0;
  const breakEven = Math.min(resumo.breakEvenPct, 100);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar iniciais={tecnico?.iniciais ?? null} size="sm" />
          <span className="text-sm font-semibold text-slate-800">
            {tecnico?.nome ?? "Sem técnico"}
          </span>
        </div>
        <span
          className={`text-lg font-bold ${positivo ? "text-emerald-600" : "text-red-600"}`}
        >
          {formatEuro(resumo.resultado)}
        </span>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <dt>Receita</dt>
          <dd className="font-mono">{formatEuro(resumo.receita)}</dd>
        </div>
        {tecnico ? (
          <div className="flex items-center justify-between text-slate-600">
            <dt>− Custo do dia</dt>
            <dd className="font-mono">{formatEuro(resumo.custoDia)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-slate-600">
          <dt>− Deslocações</dt>
          <dd className="font-mono">{formatEuro(resumo.deslocacoes)}</dd>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <dt>− Materiais</dt>
          <dd className="font-mono">{formatEuro(resumo.materiais)}</dd>
        </div>
      </dl>

      {tecnico ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              Break-even ({resumo.breakEvenPct}% de {formatEuro(resumo.custoDia)})
            </span>
            <span>Ocupação {resumo.ocupacaoPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full ${positivo ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${breakEven}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {resumo.nIntervencoes} interv. ·{" "}
            {formatarTempo(resumo.minutosProdutivos) || "0min"} ·{" "}
            {formatNumero(resumo.minutosProdutivos / 60)}h
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Sem técnico — sem custo de dia nem break-even.
        </p>
      )}
    </div>
  );
}
