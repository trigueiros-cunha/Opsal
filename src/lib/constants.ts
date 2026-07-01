import type {
  CustoTipo,
  IncidenciaEstado,
  Origem,
  Prioridade,
  ProjetoFase,
  RecorrenteTipo,
  Regiao,
  Semaforo,
} from "./types";

// ── Rótulos PT-PT para enums ─────────────────────────────────────────────────

export const REGIAO_LABEL: Record<Regiao, string> = {
  porto: "Porto",
  lisboa: "Lisboa",
  algarve: "Algarve",
};

export const ESTADO_LABEL: Record<IncidenciaEstado, string> = {
  aberta: "Aberta",
  em_curso: "Em curso",
  bloqueada: "Bloqueada",
  resolvida: "Resolvida",
  fechada: "Fechada",
};

/** Estados que contam como "ativos" (aparecem na agenda / Hoje). */
export const ESTADOS_ATIVOS: IncidenciaEstado[] = [
  "aberta",
  "em_curso",
  "bloqueada",
];

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const ORIGEM_LABEL: Record<Origem, string> = {
  hospede: "Hóspede",
  limpeza_hk: "Limpeza (HK)",
  front_office: "Front office",
  inspecao: "Inspeção",
  proprietario: "Proprietário",
};

export const CUSTO_TIPO_LABEL: Record<CustoTipo, string> = {
  mao_obra: "Mão de obra",
  material: "Material",
  deslocacao: "Deslocação",
};

/** Unidade sugerida por tipo de custo (para o campo quantidade). */
export const CUSTO_TIPO_UNIDADE: Record<CustoTipo, string> = {
  mao_obra: "h",
  material: "un",
  deslocacao: "km",
};

export const FASE_LABEL: Record<ProjetoFase, string> = {
  rascunho: "Rascunho",
  orcamento: "Orçamento",
  aprovacao: "Aprovação",
  execucao: "Execução",
  concluido: "Concluído",
};

export const FASE_ORDEM: ProjetoFase[] = [
  "rascunho",
  "orcamento",
  "aprovacao",
  "execucao",
  "concluido",
];

export const RECORRENTE_TIPO_LABEL: Record<RecorrenteTipo, string> = {
  extintores: "Extintores",
  filtros_ac: "Filtros AC",
  ralos: "Ralos",
  caixas_wc: "Caixas de esgoto WC",
};

// Anexo B — mapa tipo → título gerado + ciclo típico (meses)
export const RECORRENTE_TITULO: Record<RecorrenteTipo, string> = {
  extintores: "Extintor — verificação anual",
  filtros_ac: "Filtros AC — limpeza trimestral",
  ralos: "Ralos — desentupimento preventivo",
  caixas_wc: "Caixa de esgoto WC — limpeza",
};

export const RECORRENTE_CICLO_TIPICO: Record<RecorrenteTipo, number> = {
  extintores: 12,
  filtros_ac: 3,
  ralos: 3,
  caixas_wc: 6,
};

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: "Em dia",
  amarelo: "A vencer",
  vermelho: "Vencida",
};

// Classes Tailwind por semáforo (usadas em badges/pontos).
export const SEMAFORO_DOT: Record<Semaforo, string> = {
  verde: "bg-semaforo-verde",
  amarelo: "bg-semaforo-amarelo",
  vermelho: "bg-semaforo-vermelho",
};

// Cor por prioridade (badge).
export const PRIORIDADE_CLASSE: Record<Prioridade, string> = {
  alta: "bg-red-100 text-red-800 border-red-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  baixa: "bg-slate-100 text-slate-700 border-slate-200",
};

// Cor por estado (badge).
export const ESTADO_CLASSE: Record<IncidenciaEstado, string> = {
  aberta: "bg-blue-100 text-blue-800 border-blue-200",
  em_curso: "bg-indigo-100 text-indigo-800 border-indigo-200",
  bloqueada: "bg-orange-100 text-orange-800 border-orange-200",
  resolvida: "bg-green-100 text-green-800 border-green-200",
  fechada: "bg-slate-100 text-slate-600 border-slate-200",
};

// Listas para <select>
export const REGIOES: Regiao[] = ["porto", "lisboa", "algarve"];
export const ESTADOS: IncidenciaEstado[] = [
  "aberta",
  "em_curso",
  "bloqueada",
  "resolvida",
  "fechada",
];
export const PRIORIDADES: Prioridade[] = ["alta", "media", "baixa"];
export const ORIGENS: Origem[] = [
  "hospede",
  "limpeza_hk",
  "front_office",
  "inspecao",
  "proprietario",
];
export const CUSTO_TIPOS: CustoTipo[] = ["mao_obra", "material", "deslocacao"];
export const RECORRENTE_TIPOS: RecorrenteTipo[] = [
  "extintores",
  "filtros_ac",
  "ralos",
  "caixas_wc",
];
