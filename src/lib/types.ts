// ── OPSAL — tipos de domínio (espelham o schema Postgres, secção 3) ──────────

export type Regiao = "porto" | "lisboa" | "algarve";

export type IncidenciaEstado =
  | "aberta"
  | "em_curso"
  | "bloqueada"
  | "resolvida"
  | "fechada";

export type Prioridade = "alta" | "media" | "baixa";

export type Origem =
  | "hospede"
  | "limpeza_hk"
  | "front_office"
  | "inspecao"
  | "proprietario";

export type CustoTipo = "mao_obra" | "material" | "deslocacao";

export type RecorrenteTipo = "extintores" | "filtros_ac" | "ralos" | "caixas_wc";

export type ProjetoFase =
  | "rascunho"
  | "orcamento"
  | "aprovacao"
  | "execucao"
  | "concluido";

export type Semaforo = "verde" | "amarelo" | "vermelho";

// ── Tabelas ──────────────────────────────────────────────────────────────────

export interface Apartamento {
  id: string;
  codigo: string;
  regiao: Regiao;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Tecnico {
  id: string;
  nome: string;
  iniciais: string;
  especialidades: string[] | null;
  contacto: string | null;
  custo_hora: number;
  ativo: boolean;
  criado_em: string;
}

export interface Config {
  id: number;
  taxa_encargos_pct: number;
  horas_dia_padrao: number;
  moeda: string;
  atualizado_em: string;
}

export interface Incidencia {
  id: string;
  apartamento_id: string;
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  estado: IncidenciaEstado;
  origem: Origem;
  tecnico_id: string | null;
  bloqueada_aguarda: string | null;
  notas_resolucao: string | null;
  recorrente_id: string | null;
  aberta_em: string;
  resolvida_em: string | null;
  tempo_minutos: number | null;
  deslocacao_modo: string | null;
  deslocacao_valor: number | null;
  preco_proprietario: number | null;
  agendada_em: string | null; // date, YYYY-MM-DD
  criado_em: string;
  atualizado_em: string;
}

export interface IncidenciaCusto {
  id: string;
  incidencia_id: string;
  tipo: CustoTipo;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  origem_stock: boolean;
  stock_item_id: string | null;
  ordem: number;
  criado_em: string;
}

export interface Recorrente {
  id: string;
  apartamento_id: string;
  tipo: RecorrenteTipo;
  ciclo_meses: number;
  ultima_intervencao: string; // date
  aviso_previo_dias: number;
  tecnico_habitual_id: string | null;
  ativo: boolean;
  criado_em: string;
}

/** Linha da view `recorrentes_estado` (secção 4). */
export interface RecorrenteEstado extends Recorrente {
  apartamento_codigo: string;
  regiao: Regiao;
  proxima_data: string; // date
  dias_restantes: number;
  semaforo: Semaforo;
}

export interface Projeto {
  id: string;
  apartamento_id: string;
  titulo: string;
  descricao: string | null;
  proprietario_nome: string | null;
  fase: ProjetoFase;
  orcamento_valor: number | null;
  orcamento_ficheiro: string | null;
  aprovado_em: string | null; // date
  aprovado_nota: string | null;
  tecnico_id: string | null;
  aberto_em: string; // date
  criado_em: string;
  atualizado_em: string;
}

export interface ProjetoCusto {
  id: string;
  projeto_id: string;
  tipo: CustoTipo;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  origem_stock: boolean;
  stock_item_id: string | null;
  ordem: number;
  criado_em: string;
}

export interface Foto {
  id: string;
  incidencia_id: string | null;
  projeto_id: string | null;
  storage_path: string;
  criado_em: string;
}

// ── Tipos compostos / de UI ──────────────────────────────────────────────────

export interface IncidenciaComRelacoes extends Incidencia {
  apartamento: Pick<Apartamento, "id" | "codigo" | "regiao"> | null;
  tecnico: Pick<Tecnico, "id" | "nome" | "iniciais" | "custo_hora"> | null;
}

export interface ProjetoComRelacoes extends Projeto {
  apartamento: Pick<Apartamento, "id" | "codigo" | "regiao"> | null;
  tecnico: Pick<Tecnico, "id" | "nome" | "iniciais"> | null;
}

export type EventoKind = "inc" | "rec" | "proj";

export interface EventoAgenda {
  id: string;
  kind: EventoKind;
  apartamento_codigo: string;
  titulo: string;
  tecnico_id: string | null;
  data: string; // YYYY-MM-DD
}

// Resposta da extração WhatsApp (secção 5)
export interface ExtracaoIncidencia {
  apartamento_codigo: string | null;
  apartamento_reconhecido: boolean;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  origem_sugerida: Origem;
}
