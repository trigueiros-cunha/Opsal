import { Badge } from "@/components/ui/Badge";
import {
  ESTADO_CLASSE,
  ESTADO_LABEL,
  FASE_LABEL,
  PRIORIDADE_CLASSE,
  PRIORIDADE_LABEL,
  REGIAO_LABEL,
  SEMAFORO_DOT,
  SEMAFORO_LABEL,
} from "@/lib/constants";
import type {
  IncidenciaEstado,
  Prioridade,
  ProjetoFase,
  Regiao,
  Semaforo,
} from "@/lib/types";

export function EstadoBadge({ estado }: { estado: IncidenciaEstado }) {
  return <Badge className={ESTADO_CLASSE[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  return (
    <Badge className={PRIORIDADE_CLASSE[prioridade]}>
      {PRIORIDADE_LABEL[prioridade]}
    </Badge>
  );
}

export function RegiaoBadge({ regiao }: { regiao: Regiao }) {
  return (
    <Badge className="border-slate-200 bg-slate-50 text-slate-600">
      {REGIAO_LABEL[regiao]}
    </Badge>
  );
}

export function FaseBadge({ fase }: { fase: ProjetoFase }) {
  const cores: Record<ProjetoFase, string> = {
    rascunho: "bg-slate-100 text-slate-600 border-slate-200",
    orcamento: "bg-blue-100 text-blue-800 border-blue-200",
    aprovacao: "bg-amber-100 text-amber-800 border-amber-200",
    execucao: "bg-violet-100 text-violet-800 border-violet-200",
    concluido: "bg-green-100 text-green-800 border-green-200",
  };
  return <Badge className={cores[fase]}>{FASE_LABEL[fase]}</Badge>;
}

export function SemaforoBadge({ semaforo }: { semaforo: Semaforo }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`h-2.5 w-2.5 rounded-full ${SEMAFORO_DOT[semaforo]}`} />
      {SEMAFORO_LABEL[semaforo]}
    </span>
  );
}
