# Encomendas + Lista de compras — Design

Data: 2026-07-09
Estado: proposta (aprovada em brainstorming, a rever no ficheiro)

## Objetivo

Criar uma área própria para **compras da empresa**, separada das incidências, para
que uma compra deixe de aparecer como "prejuízo" no P&L de um trabalho. Duas peças
ligadas:

1. **Lista de compras** — captura rápida de coisas a comprar; ficam pendentes até
   se comprarem.
2. **Encomendas** — a compra registada (pedido multi-linha), com destino
   (proprietário / stock / consumo), fornecedor, datas, estado, pagamento ao
   fornecedor e **fatura anexada**.

O fluxo natural: **lista de compras → (comprar) → encomenda**.

## Contexto no codebase

- Não existe entidade "owner": os projetos usam `proprietario_nome` (texto livre);
  os apartamentos (`apartamentos.codigo`, região) são o âncora concreto de local/owner.
- Custos de trabalho vivem em `incidencia_custos` / `projeto_custos` (com
  `custo_tipo`, `origem_stock`, `stock_item_id` — gancho de catálogo externo futuro).
- Upload de ficheiros já existe (PDF do orçamento em projetos): bucket privado
  `FOTOS_BUCKET` + `signedUrl` (`src/lib/data/storage.ts`, `uploadOrcamento`).
- Módulo de Rentabilidade (Workometer) calcula P&L de incidências/projetos; as
  encomendas **não** entram nesse cálculo.
- Padrões: server actions com `exigirSessao()` + `revalidatePath`; data layer
  `import "server-only"` + `supabaseAdmin()`; helpers `formatEuro`, `totalLinha`,
  `formatData` em `src/lib/format.ts`; classes `card`/`input`/`label`/`btn-*`.

## Decisões (fechadas em brainstorming)

1. **Âmbito v1:** registo + categorização (sem contas-a-receber por owner, sem
   inventário consumível).
2. **Destino da encomenda:** `proprietario` (adiantamento a recuperar) / `stock` /
   `consumo` (uso da empresa).
3. **Identificação do owner:** por **apartamento** (`apartamento_id`, opcional; usado
   quando destino = `proprietario`; vazio para stock/consumo).
4. **Estrutura:** encomenda = **cabeçalho + várias linhas** (um pedido pode ter
   vários artigos, uma fatura).
5. **Pagamento:** ao **fornecedor** (se a empresa já pagou e como), não reembolso do
   owner.
6. **Fatura:** ficheiro anexado (PDF/imagem), reutilizando o bucket privado + `signedUrl`.
7. **Lista de compras → encomenda:** ao comprar, selecionam-se **1 ou vários** itens
   e cria-se **uma** encomenda com eles como linhas; os itens saem da lista
   (marcados como comprados e ligados à encomenda).
8. **Rentabilidade:** encomendas ficam **fora** do P&L de incidências/projetos.

## Modelo de dados

SQL a correr no Supabase (e a juntar a `db/schema.sql`):

```sql
-- Enums
do $$ begin
  create type encomenda_destino as enum ('proprietario','stock','consumo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type encomenda_estado as enum ('encomendada','recebida');
exception when duplicate_object then null; end $$;
do $$ begin
  create type encomenda_pagamento as enum ('por_pagar','pago');
exception when duplicate_object then null; end $$;

-- Encomendas (cabeçalho)
create table if not exists encomendas (
  id               uuid primary key default gen_random_uuid(),
  titulo           text,                       -- opcional (scan rápido na lista)
  destino          encomenda_destino not null,
  apartamento_id   uuid references apartamentos(id),   -- destino = proprietario
  fornecedor       text,
  data_encomenda   date not null default current_date,
  estado           encomenda_estado not null default 'encomendada',
  data_rececao     date,
  pagamento        encomenda_pagamento not null default 'por_pagar',
  metodo_pagamento text,                        -- dinheiro/cartão/transferência/MB Way/…
  fatura_ficheiro  text,                        -- storage path (PDF/imagem)
  notas            text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists encomendas_destino_idx on encomendas (destino);
create index if not exists encomendas_apartamento_idx on encomendas (apartamento_id);

-- Linhas da encomenda
create table if not exists encomenda_linhas (
  id             uuid primary key default gen_random_uuid(),
  encomenda_id   uuid not null references encomendas(id) on delete cascade,
  descricao      text not null,
  quantidade     numeric(10,2) not null default 1,
  valor_unitario numeric(10,2) not null default 0,
  ordem          int not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists encomenda_linhas_encomenda_idx
  on encomenda_linhas (encomenda_id);

-- Lista de compras
create table if not exists lista_compras (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  quantidade     numeric(10,2) not null default 1,
  apartamento_id uuid references apartamentos(id),   -- opcional (para que apê)
  notas          text,
  comprado       boolean not null default false,     -- true ao converter
  encomenda_id   uuid references encomendas(id) on delete set null,  -- encomenda gerada
  criado_em      timestamptz not null default now()
);
create index if not exists lista_compras_pendentes_idx
  on lista_compras (criado_em) where not comprado;

-- Trigger de atualizado_em (função já existe no schema)
drop trigger if exists encomendas_atualizado_em on encomendas;
create trigger encomendas_atualizado_em before update on encomendas
  for each row execute function set_atualizado_em();
```

Total da encomenda = `Σ (quantidade × valor_unitario)` das linhas.

## Tipos (`src/lib/types.ts`)

```ts
export type EncomendaDestino = "proprietario" | "stock" | "consumo";
export type EncomendaEstado = "encomendada" | "recebida";
export type EncomendaPagamento = "por_pagar" | "pago";

export interface Encomenda {
  id: string;
  titulo: string | null;
  destino: EncomendaDestino;
  apartamento_id: string | null;
  fornecedor: string | null;
  data_encomenda: string;        // date
  estado: EncomendaEstado;
  data_rececao: string | null;   // date
  pagamento: EncomendaPagamento;
  metodo_pagamento: string | null;
  fatura_ficheiro: string | null;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EncomendaLinha {
  id: string;
  encomenda_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  ordem: number;
  criado_em: string;
}

export interface EncomendaComRelacoes extends Encomenda {
  apartamento: Pick<Apartamento, "id" | "codigo" | "regiao"> | null;
  total: number; // Σ linhas (calculado)
}

export interface ListaCompraItem {
  id: string;
  descricao: string;
  quantidade: number;
  apartamento_id: string | null;
  notas: string | null;
  comprado: boolean;
  encomenda_id: string | null;
  criado_em: string;
}
```

## Cálculo (`src/lib/encomenda.ts`, TS puro)

```
totalEncomenda(linhas: { quantidade: number; valor_unitario: number }[]): number
   = round2(Σ quantidade × valor_unitario)
```
Testável com vitest. (Reaproveita a ideia do `totalLinha` de `format.ts`.)

## Constantes (`src/lib/constants.ts`)

Rótulos e classes de badge:
- `ENCOMENDA_DESTINO_LABEL`: proprietario → "Proprietário", stock → "Stock",
  consumo → "Consumo".
- `ENCOMENDA_ESTADO_LABEL`: encomendada → "Encomendada", recebida → "Recebida".
- `ENCOMENDA_PAGAMENTO_LABEL`: por_pagar → "Por pagar", pago → "Pago".
- Listas `ENCOMENDA_DESTINOS`, `ENCOMENDA_ESTADOS`, `ENCOMENDA_PAGAMENTOS` para
  `<select>` e classes de cor (badge) por destino/estado/pagamento.
- `METODOS_PAGAMENTO`: ["Dinheiro", "Cartão", "Transferência", "MB Way"] (sugestões;
  o campo aceita texto livre).

## Camada de dados

`src/lib/data/encomendas.ts` (`import "server-only"`):
- `listEncomendas(filtros?: { destino?; estado? }): Promise<EncomendaComRelacoes[]>`
  — join apartamento + soma de linhas (total).
- `getEncomenda(id): Promise<EncomendaComRelacoes | null>`.
- `listLinhas(encomendaId): Promise<EncomendaLinha[]>`.
- `criarEncomenda(input): Promise<string>` (devolve id).
- `atualizarEncomenda(id, patch)`.
- `apagarEncomenda(id)` (remove ficheiro da fatura no storage; linhas caem por cascade).
- `adicionarLinha/atualizarLinha/removerLinha`.
- `definirFatura(id, path)` / `removerFatura(id)`.

`src/lib/data/lista_compras.ts`:
- `listPendentes(): Promise<ListaCompraItem[]>` (comprado=false, mais recentes primeiro).
- `adicionarItem(input)`, `atualizarItem(id, patch)`, `removerItem(id)`.
- `converterEmEncomenda(itemIds: string[], header: { destino; apartamento_id? }):
  Promise<string>` — cria a encomenda + uma linha por item; marca os itens
  `comprado=true` + `encomenda_id`; devolve o id da encomenda.

## Server actions (`src/app/(app)/encomendas/actions.ts`)

- `criarEncomenda(formData)` → redirect ao detalhe.
- `atualizarEncomenda(formData)`, `apagarEncomenda(formData)`.
- `adicionarLinha/atualizarLinha/removerLinha(formData)`.
- `uploadFatura(formData)` (ficheiro → storage → `definirFatura`),
  `removerFatura(formData)`.
- `adicionarItemLista/atualizarItemLista/removerItemLista(formData)`.
- `criarEncomendaDeItens(formData)` — lê `itemIds` (múltiplos), `destino`,
  `apartamento_id`; chama `converterEmEncomenda`; `redirect` ao detalhe da encomenda.

## UI

Uma entrada **Encomendas** (📦) na `Sidebar` → `/encomendas`.

### `/encomendas` — página principal (dois blocos)
1. **Lista de compras** (topo):
   - Input de captura rápida ("+ adicionar à lista") — só descrição obrigatória;
     qtd/apartamento/nota opcionais (expansível).
   - Itens pendentes com **checkbox** (multi-seleção) + editar/apagar.
   - Botão **"Criar encomenda dos selecionados"** → mini-form (destino +
     apartamento se `proprietario`) → `criarEncomendaDeItens` → detalhe da encomenda.
   - Componente cliente `ListaCompras` (seleção + ações).
2. **Encomendas** (baixo): lista (cartões/linhas) com título, **badge de destino**,
   apartamento (se proprietário), **total**, **estado**, **pagamento**, data. Filtro
   por destino/estado. Liga a `/encomendas/[id]`.

### `/encomendas/nova` — nova encomenda manual
Cabeçalho: destino (mostra apartamento se `proprietario`), fornecedor, datas, estado,
pagamento + método, título, notas. Cria e vai ao detalhe.

### `/encomendas/[id]` — detalhe
- Cabeçalho editável (server action `atualizarEncomenda`).
- **Editor de linhas** — componente dedicado leve `EncomendaLinhasEditor` (add/editar/
  remover artigos; total em tempo real), no estilo do `CustosEditor` mas **sem** coluna
  `tipo`/stock.
- **Importar fatura** (PDF/imagem) — `uploadFatura` + link `signedUrl` (padrão do
  orçamento nos projetos); remover.
- Apagar encomenda.

## Erros / casos-limite

- Item da lista sem descrição → não adiciona.
- Converter sem itens selecionados → não faz nada (botão desativado).
- Destino `proprietario` sem apartamento → permitido, com aviso suave.
- Itens selecionados de apartamentos diferentes → o cabeçalho da encomenda leva um
  único `apartamento_id` (escolhido no mini-form); o do item é só dica.
- `data_rececao` sem estado "recebida" → permitido (não bloqueia).
- Totais a 2 casas.
- Apagar encomenda → remove o ficheiro da fatura no storage; as linhas caem por
  cascade; itens da lista que apontavam para ela mantêm `comprado=true` e o
  `encomenda_id` fica `null` (via `on delete set null`) — sem bloquear o delete.
- **Nada disto entra no P&L** de incidências/projetos.

## Testes

- Unit (vitest, puro): `totalEncomenda` (linhas várias, vazia, arredondamento).
- Manual:
  - Adicionar itens à lista; selecionar 1 e vários; criar encomenda; confirmar que
    saem da lista e viram linhas na encomenda.
  - No detalhe: preencher preços, fornecedor, marcar recebida (com data), anexar
    fatura e reabri-la.
  - Confirmar que a encomenda **não** aparece em nenhum P&L (incidência/projeto/
    dashboard de rentabilidade).

## Ficheiros

**Criar:**
- `src/lib/encomenda.ts` (+ `src/lib/encomenda.test.ts`)
- `src/lib/data/encomendas.ts`
- `src/lib/data/lista_compras.ts`
- `src/app/(app)/encomendas/page.tsx`
- `src/app/(app)/encomendas/actions.ts`
- `src/app/(app)/encomendas/ListaCompras.tsx` (cliente — captura + seleção + converter)
- `src/app/(app)/encomendas/nova/page.tsx` (+ formulário)
- `src/app/(app)/encomendas/[id]/page.tsx`
- `src/app/(app)/encomendas/[id]/EncomendaLinhasEditor.tsx`
- `src/app/(app)/encomendas/[id]/EncomendaHeaderForm.tsx` (cabeçalho editável)

**Modificar:**
- `db/schema.sql` (enums + 3 tabelas + trigger)
- `src/lib/types.ts` (tipos novos)
- `src/lib/constants.ts` (rótulos/classes/listas)
- `src/components/Sidebar.tsx` (entrada "Encomendas")

## Fora de âmbito (v1)

- Contas-a-receber por owner (reembolso do adiantamento).
- Inventário de stock consumível (destino `stock` é só etiqueta) e ligação ao
  catálogo externo (`origem_stock`/`stock_item_id`).
- Multi-destino por encomenda.
- Entrada de encomendas em qualquer P&L / relatório de custos da empresa.
