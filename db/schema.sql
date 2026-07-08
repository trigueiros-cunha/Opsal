-- ═══════════════════════════════════════════════════════════════════════════
-- OPSAL — Schema Postgres / Supabase (secção 3 do brief)
-- Aplicar no SQL Editor do Supabase (ou via `psql`). Idempotente onde possível.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensões ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type regiao as enum ('porto', 'lisboa', 'algarve');
exception when duplicate_object then null; end $$;

do $$ begin
  create type incidencia_estado as enum
    ('aberta', 'em_curso', 'bloqueada', 'resolvida', 'fechada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prioridade as enum ('alta', 'media', 'baixa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type origem as enum
    ('hospede', 'limpeza_hk', 'front_office', 'inspecao', 'proprietario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type custo_tipo as enum ('mao_obra', 'material', 'deslocacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recorrente_tipo as enum
    ('extintores', 'filtros_ac', 'ralos', 'caixas_wc');
exception when duplicate_object then null; end $$;

do $$ begin
  create type projeto_fase as enum
    ('rascunho', 'orcamento', 'aprovacao', 'execucao', 'concluido');
exception when duplicate_object then null; end $$;

-- ── apartamentos ─────────────────────────────────────────────────────────────
create table if not exists apartamentos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  regiao      regiao not null,
  descricao   text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists apartamentos_regiao_ativo_idx
  on apartamentos (regiao) where ativo;
create index if not exists apartamentos_codigo_idx on apartamentos (codigo);

-- ── tecnicos ─────────────────────────────────────────────────────────────────
create table if not exists tecnicos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  iniciais       text not null,
  especialidades text[],
  contacto       text,
  custo_hora     numeric(10,2) not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- ── recorrentes (definida antes de incidencias por FK cruzada) ───────────────
create table if not exists recorrentes (
  id                  uuid primary key default gen_random_uuid(),
  apartamento_id      uuid not null references apartamentos(id),
  tipo                recorrente_tipo not null,
  ciclo_meses         int not null,
  ultima_intervencao  date not null,
  aviso_previo_dias   int not null default 15,
  tecnico_habitual_id uuid references tecnicos(id),
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now()
);
create index if not exists recorrentes_apartamento_idx
  on recorrentes (apartamento_id);

-- ── incidencias ──────────────────────────────────────────────────────────────
create table if not exists incidencias (
  id                uuid primary key default gen_random_uuid(),
  apartamento_id    uuid not null references apartamentos(id),
  titulo            text not null,
  descricao         text,
  prioridade        prioridade not null default 'media',
  estado            incidencia_estado not null default 'aberta',
  origem            origem not null default 'hospede',
  tecnico_id        uuid references tecnicos(id),
  bloqueada_aguarda text,
  notas_resolucao   text,
  recorrente_id     uuid references recorrentes(id),
  aberta_em         timestamptz not null default now(),
  resolvida_em      timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists incidencias_estado_idx on incidencias (estado);
create index if not exists incidencias_apartamento_idx on incidencias (apartamento_id);
create index if not exists incidencias_tecnico_idx on incidencias (tecnico_id);
create index if not exists incidencias_aberta_em_idx on incidencias (aberta_em desc);

-- import (idempotência do import de Excel): assinatura CASA+DATA+PROBLEMA.
-- Índice único NÃO parcial: em Postgres os NULL são distintos, por isso
-- incidências criadas à mão (import_ref NULL) não colidem, e o upsert
-- ON CONFLICT (import_ref) funciona.
alter table incidencias add column if not exists import_ref text;
create unique index if not exists incidencias_import_ref_key
  on incidencias (import_ref);

-- trabalho e deslocação (fecho de incidência / registo para a empresa)
alter table incidencias add column if not exists tempo_minutos int;
alter table incidencias add column if not exists deslocacao_modo text;
alter table incidencias add column if not exists deslocacao_valor numeric(10,2);

-- ── incidencia_custos ────────────────────────────────────────────────────────
create table if not exists incidencia_custos (
  id             uuid primary key default gen_random_uuid(),
  incidencia_id  uuid not null references incidencias(id) on delete cascade,
  tipo           custo_tipo not null,
  descricao      text not null,
  quantidade     numeric(10,2) not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  origem_stock   boolean not null default false,
  stock_item_id  text,
  ordem          int not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists incidencia_custos_incidencia_idx
  on incidencia_custos (incidencia_id);

-- ── projetos ─────────────────────────────────────────────────────────────────
create table if not exists projetos (
  id                 uuid primary key default gen_random_uuid(),
  apartamento_id     uuid not null references apartamentos(id),
  titulo             text not null,
  descricao          text,
  proprietario_nome  text,
  fase               projeto_fase not null default 'rascunho',
  orcamento_valor    numeric(12,2),
  orcamento_ficheiro text,
  aprovado_em        date,
  aprovado_nota      text,
  tecnico_id         uuid references tecnicos(id),
  aberto_em          date not null default current_date,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index if not exists projetos_fase_idx on projetos (fase);
create index if not exists projetos_apartamento_idx on projetos (apartamento_id);

-- ── projeto_custos (mesma estrutura de incidencia_custos) ────────────────────
create table if not exists projeto_custos (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projetos(id) on delete cascade,
  tipo           custo_tipo not null,
  descricao      text not null,
  quantidade     numeric(10,2) not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  origem_stock   boolean not null default false,
  stock_item_id  text,
  ordem          int not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists projeto_custos_projeto_idx
  on projeto_custos (projeto_id);

-- ── fotos ────────────────────────────────────────────────────────────────────
create table if not exists fotos (
  id            uuid primary key default gen_random_uuid(),
  incidencia_id uuid references incidencias(id) on delete cascade,
  projeto_id    uuid references projetos(id) on delete cascade,
  storage_path  text not null,
  criado_em     timestamptz not null default now(),
  check (
    (incidencia_id is not null and projeto_id is null) or
    (incidencia_id is null and projeto_id is not null)
  )
);
create index if not exists fotos_incidencia_idx on fotos (incidencia_id);
create index if not exists fotos_projeto_idx on fotos (projeto_id);

-- ── trigger: atualizado_em automático ────────────────────────────────────────
create or replace function set_atualizado_em() returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists incidencias_atualizado_em on incidencias;
create trigger incidencias_atualizado_em before update on incidencias
  for each row execute function set_atualizado_em();

drop trigger if exists projetos_atualizado_em on projetos;
create trigger projetos_atualizado_em before update on projetos
  for each row execute function set_atualizado_em();

-- ── view: recorrentes_estado (secção 4) ──────────────────────────────────────
create or replace view recorrentes_estado as
select
  r.*,
  a.codigo as apartamento_codigo,
  a.regiao,
  (r.ultima_intervencao + (r.ciclo_meses || ' months')::interval)::date
    as proxima_data,
  ((r.ultima_intervencao + (r.ciclo_meses || ' months')::interval)::date
    - current_date) as dias_restantes,
  case
    when ((r.ultima_intervencao + (r.ciclo_meses || ' months')::interval)::date
      - current_date) < 0 then 'vermelho'
    when ((r.ultima_intervencao + (r.ciclo_meses || ' months')::interval)::date
      - current_date) <= r.aviso_previo_dias then 'amarelo'
    else 'verde'
  end as semaforo
from recorrentes r
join apartamentos a on a.id = r.apartamento_id
where r.ativo;

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage: criar bucket privado `manutencao-fotos` (Dashboard → Storage) e
-- servir sempre via signed URLs. Não é criado por SQL aqui.
-- Single-user: sem RLS por utilizador. A service_role key (server-side) tem
-- acesso total; nunca expor no cliente.
-- ═══════════════════════════════════════════════════════════════════════════
