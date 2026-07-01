import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {titulo}
        </h1>
        {descricao ? (
          <p className="mt-1 text-sm text-slate-500">{descricao}</p>
        ) : null}
      </div>
      {acao ? <div className="flex items-center gap-2">{acao}</div> : null}
    </div>
  );
}
