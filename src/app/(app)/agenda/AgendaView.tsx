"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { adicionarDias, inicioDaSemana, toISODate } from "@/lib/format";
import type { EventoAgenda, EventoKind } from "@/lib/types";

type TecSelect = { id: string; nome: string; iniciais: string };
type Modo = "tecnico" | "dia";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const KIND_LABEL: Record<EventoKind, string> = {
  inc: "Incidência",
  rec: "Recorrente",
  proj: "Projeto",
};

const KIND_CLASSE: Record<EventoKind, string> = {
  inc: "bg-red-50 border-red-300 text-red-800",
  rec: "bg-green-50 border-green-300 text-green-800",
  proj: "bg-violet-50 border-violet-300 text-violet-800",
};

function hrefEvento(e: EventoAgenda): string {
  if (e.kind === "inc") return `/incidencias/${e.id}`;
  if (e.kind === "proj") return `/projetos/${e.id}`;
  return "/recorrentes";
}

export function AgendaView({ tecnicos }: { tecnicos: TecSelect[] }) {
  const [inicio, setInicio] = useState<string>(() =>
    toISODate(inicioDaSemana(new Date())),
  );
  const [modo, setModo] = useState<Modo>("tecnico");
  const [filtros, setFiltros] = useState<Record<EventoKind, boolean>>({
    inc: true,
    rec: true,
    proj: true,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agenda", inicio],
    queryFn: async () => {
      const res = await fetch(`/api/agenda?inicio=${inicio}`);
      if (!res.ok) throw new Error("Falha a carregar agenda");
      return (await res.json()) as { inicio: string; eventos: EventoAgenda[] };
    },
  });

  const dias = useMemo(() => {
    const base = new Date(inicio + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => toISODate(adicionarDias(base, i)));
  }, [inicio]);

  const eventos = (data?.eventos ?? []).filter((e) => filtros[e.kind]);

  function navegar(deltaSemanas: number) {
    const base = new Date(inicio + "T00:00:00");
    setInicio(toISODate(adicionarDias(base, deltaSemanas * 7)));
  }

  function estaSemana() {
    setInicio(toISODate(inicioDaSemana(new Date())));
  }

  const linhas =
    modo === "tecnico"
      ? [
          ...tecnicos.map((t) => ({ id: t.id, nome: t.nome, iniciais: t.iniciais })),
          { id: null as string | null, nome: "Por atribuir", iniciais: "?" },
        ]
      : [];

  return (
    <div>
      {/* Barra de controlo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="btn-secondary px-2 py-1">
            ←
          </button>
          <button onClick={estaSemana} className="btn-secondary px-3 py-1 text-xs">
            Esta semana
          </button>
          <button onClick={() => navegar(1)} className="btn-secondary px-2 py-1">
            →
          </button>
          <span className="ml-2 text-sm font-medium text-slate-600">
            {dias[0].split("-").reverse().slice(0, 2).join("/")} –{" "}
            {dias[6].split("-").reverse().slice(0, 2).join("/")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Modo */}
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setModo("tecnico")}
              className={`px-3 py-1.5 text-xs ${modo === "tecnico" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              Por técnico
            </button>
            <button
              onClick={() => setModo("dia")}
              className={`px-3 py-1.5 text-xs ${modo === "dia" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
            >
              Por dia
            </button>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1.5">
            {(["inc", "rec", "proj"] as EventoKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setFiltros((f) => ({ ...f, [k]: !f[k] }))}
                className={`badge border px-2 py-1 ${
                  filtros[k] ? KIND_CLASSE[k] : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          A carregar…
        </div>
      ) : isError ? (
        <div className="card border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar a agenda.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th w-32">
                  {modo === "tecnico" ? "Técnico" : ""}
                </th>
                {dias.map((d, i) => (
                  <th key={d} className="th text-center">
                    <div>{DIAS[i]}</div>
                    <div className="font-normal text-slate-400">
                      {d.split("-").reverse().slice(0, 2).join("/")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modo === "tecnico" ? (
                linhas.map((linha) => (
                  <tr key={linha.id ?? "nulo"} className="align-top">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Avatar
                          iniciais={linha.id ? linha.iniciais : null}
                          size="sm"
                        />
                        <span className="text-xs font-medium">{linha.nome}</span>
                      </div>
                    </td>
                    {dias.map((d) => (
                      <td key={d} className="td">
                        <div className="space-y-1">
                          {eventos
                            .filter(
                              (e) => e.data === d && e.tecnico_id === linha.id,
                            )
                            .map((e) => (
                              <EventoChip key={`${e.kind}-${e.id}`} evento={e} />
                            ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="align-top">
                  <td className="td" />
                  {dias.map((d) => (
                    <td key={d} className="td">
                      <div className="space-y-1">
                        {eventos
                          .filter((e) => e.data === d)
                          .map((e) => (
                            <EventoChip key={`${e.kind}-${e.id}`} evento={e} />
                          ))}
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-red-300 bg-red-50" />
          Incidência
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-green-300 bg-green-50" />
          Recorrente
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-violet-300 bg-violet-50" />
          Projeto
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-dashed border-slate-400" />
          Por atribuir
        </span>
      </div>
    </div>
  );
}

function EventoChip({ evento }: { evento: EventoAgenda }) {
  const semTecnico = evento.tecnico_id === null;
  return (
    <Link
      href={hrefEvento(evento)}
      className={`block rounded border px-1.5 py-1 text-[11px] leading-tight ${KIND_CLASSE[evento.kind]} ${semTecnico ? "border-dashed" : ""}`}
      title={`${KIND_LABEL[evento.kind]} · ${evento.apartamento_codigo}`}
    >
      <span className="font-semibold">{evento.apartamento_codigo}</span>{" "}
      <span className="opacity-80">
        {evento.agendado ? "✎ " : ""}
        {evento.titulo}
      </span>
    </Link>
  );
}
