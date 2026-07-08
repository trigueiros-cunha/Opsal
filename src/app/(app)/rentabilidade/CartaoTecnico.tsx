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

      <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
        <div>
          <p className="font-semibold text-slate-700">{formatEuro(resumo.receita)}</p>
          <p>Receita</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">{formatEuro(resumo.custoTotal)}</p>
          <p>Custo</p>
        </div>
        <div>
          <p className="font-semibold text-slate-700">{resumo.nIntervencoes}</p>
          <p>Intervenções</p>
        </div>
      </div>

      {tecnico ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              Break-even ({resumo.breakEvenPct}% de {formatEuro(resumo.custoFixoDia)})
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
            {formatarTempo(resumo.minutosProdutivos) || "0min"} produtivos ·{" "}
            {formatNumero(resumo.minutosProdutivos / 60)}h
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Sem técnico atribuído — sem custo de tempo nem break-even.
        </p>
      )}
    </div>
  );
}
