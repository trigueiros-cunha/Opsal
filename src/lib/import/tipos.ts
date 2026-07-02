import type { Prioridade, IncidenciaEstado, Origem, Regiao } from "@/lib/types";

export type LinhaCrua = Record<string, string>;

export interface ApartamentoRef {
  id: string;
  regiao: Regiao;
}
export type MapaApartamentos = Map<string, ApartamentoRef>;

export interface CamposIncidencia {
  apartamento_id: string;
  apartamento_codigo: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  estado: IncidenciaEstado;
  origem: Origem;
  aberta_em: string; // YYYY-MM-DD
  resolvida_em: string | null;
  import_ref: string;
  problema: string; // PROBLEMA cru, para a IA na inserção
}

export type LinhaMapeada =
  | { status: "ok"; linha: number; campos: CamposIncidencia }
  | { status: "erro"; linha: number; motivo: string; casa: string; problema: string };

export interface ResultadoAnalise {
  novas: CamposIncidencia[];
  existem: number;
  erros: { linha: number; motivo: string; casa: string; problema: string }[];
  total: number;
}
