# Encomendas + Lista de Compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company-purchases area (Encomendas) with a quick-capture shopping list that converts selected items into a multi-line order, kept entirely outside the incidência/projeto P&L.

**Architecture:** Three new tables (`encomendas` header, `encomenda_linhas` items, `lista_compras`). A pure total helper in `src/lib/encomenda.ts`; server-only data layers; server actions following the existing `exigirSessao`/`revalidatePath` pattern; a new `/encomendas` area reusing existing UI patterns (CustosEditor-style line editor, projeto-orçamento-style file upload).

**Tech Stack:** Next.js 14 (App Router, Server Components + Server Actions), TypeScript, Supabase (`supabaseAdmin` service-role, server-only), TailwindCSS, Vitest (pure-logic tests only).

## Global Constraints

- **Language/copy:** all UI copy in **PT-PT**.
- **Money:** euro totals **rounded to 2 decimals** (`Math.round(x*100)/100`); reuse `totalLinha` from `src/lib/format.ts`.
- **Outside P&L:** encomendas and shopping-list items must **not** be read by any Rentabilidade / incidência / projeto P&L code. Do not touch `src/lib/data/rentabilidade.ts` or `src/lib/custo.ts`.
- **Data layer:** files touching Supabase start with `import "server-only";` and use `supabaseAdmin()`. Server actions call `await exigirSessao()` first and `revalidatePath(...)` after writes.
- **Destino identifies owner by apartment:** `apartamento_id` (nullable) is used when `destino='proprietario'`; null for stock/consumo.
- **File upload:** reuse the private bucket `FOTOS_BUCKET` + `signedUrl` from `src/lib/data/storage.ts` (same as `uploadOrcamento` in projetos). Path prefix `encomendas/{id}/`.
- **No new dependencies.** Reuse `formatEuro`, `formatData`, `totalLinha` (`src/lib/format.ts`), the `Badge` component (`src/components/ui/Badge.tsx`), and the `card`/`input`/`label`/`btn-primary`/`btn-secondary`/`th`/`td` classes.
- **Action FormData helpers:** copy the local `str`/`num`/`strOuNull`/`numOuNull` helpers already used in `incidencias/actions.ts` and `projetos/actions.ts`.
- **Verification gate for non-test tasks:** `npm run typecheck` must pass (`tsc --noEmit`).

---

## File Structure

**Create:**
- `src/lib/encomenda.ts` (+ `src/lib/encomenda.test.ts`) — pure `totalEncomenda`.
- `src/lib/data/encomendas.ts` — encomenda CRUD + lines + fatura.
- `src/lib/data/lista_compras.ts` — shopping list CRUD + conversion.
- `src/app/(app)/encomendas/actions.ts` — server actions.
- `src/app/(app)/encomendas/page.tsx` — main area (shopping list + orders list).
- `src/app/(app)/encomendas/ListaCompras.tsx` — client: capture + multi-select + convert.
- `src/app/(app)/encomendas/EncomendaForm.tsx` — client: create/edit header form.
- `src/app/(app)/encomendas/nova/page.tsx` — new order.
- `src/app/(app)/encomendas/[id]/page.tsx` — order detail.
- `src/app/(app)/encomendas/[id]/EncomendaLinhasEditor.tsx` — client: line items editor.
- `src/app/(app)/encomendas/[id]/FaturaPanel.tsx` — client: invoice upload/remove.

**Modify:**
- `db/schema.sql` — enums + 3 tables + trigger.
- `src/lib/types.ts` — new types.
- `src/lib/constants.ts` — labels/classes/lists.
- `src/components/Sidebar.tsx` — "Encomendas" nav entry.

---

## Task 1: Data model — tables, types, constants

**Files:**
- Modify: `db/schema.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: tables `encomendas`, `encomenda_linhas`, `lista_compras`; types `EncomendaDestino`/`EncomendaEstado`/`EncomendaPagamento`, `Encomenda`, `EncomendaLinha`, `EncomendaComRelacoes`, `ListaCompraItem`; constants `ENCOMENDA_DESTINO_LABEL`/`ENCOMENDA_ESTADO_LABEL`/`ENCOMENDA_PAGAMENTO_LABEL`/`ENCOMENDA_DESTINOS`/`ENCOMENDA_ESTADOS`/`ENCOMENDA_PAGAMENTOS`/`METODOS_PAGAMENTO`/`ENCOMENDA_DESTINO_CLASSE`/`ENCOMENDA_PAGAMENTO_CLASSE`.

- [ ] **Step 1: Add enums + tables to `db/schema.sql`**

Append before the "Storage" comment block at the end of `db/schema.sql`:

```sql
-- ── Encomendas (compras da empresa) ──────────────────────────────────────────
do $$ begin
  create type encomenda_destino as enum ('proprietario','stock','consumo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type encomenda_estado as enum ('encomendada','recebida');
exception when duplicate_object then null; end $$;
do $$ begin
  create type encomenda_pagamento as enum ('por_pagar','pago');
exception when duplicate_object then null; end $$;

create table if not exists encomendas (
  id               uuid primary key default gen_random_uuid(),
  titulo           text,
  destino          encomenda_destino not null,
  apartamento_id   uuid references apartamentos(id),
  fornecedor       text,
  data_encomenda   date not null default current_date,
  estado           encomenda_estado not null default 'encomendada',
  data_rececao     date,
  pagamento        encomenda_pagamento not null default 'por_pagar',
  metodo_pagamento text,
  fatura_ficheiro  text,
  notas            text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists encomendas_destino_idx on encomendas (destino);
create index if not exists encomendas_apartamento_idx on encomendas (apartamento_id);

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

create table if not exists lista_compras (
  id             uuid primary key default gen_random_uuid(),
  descricao      text not null,
  quantidade     numeric(10,2) not null default 1,
  apartamento_id uuid references apartamentos(id),
  notas          text,
  comprado       boolean not null default false,
  encomenda_id   uuid references encomendas(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index if not exists lista_compras_pendentes_idx
  on lista_compras (criado_em) where not comprado;

drop trigger if exists encomendas_atualizado_em on encomendas;
create trigger encomendas_atualizado_em before update on encomendas
  for each row execute function set_atualizado_em();
```

- [ ] **Step 2: Apply the SQL in Supabase**

Run the Step 1 block in the Supabase SQL Editor. Idempotent (`if not exists` / `do $$ … duplicate_object`).

- [ ] **Step 3: Add types to `src/lib/types.ts`**

Add near the other type aliases (after `ProjetoFase`):

```ts
export type EncomendaDestino = "proprietario" | "stock" | "consumo";
export type EncomendaEstado = "encomendada" | "recebida";
export type EncomendaPagamento = "por_pagar" | "pago";
```

Add these interfaces in the "Tabelas" block (after `ProjetoCusto`):

```ts
export interface Encomenda {
  id: string;
  titulo: string | null;
  destino: EncomendaDestino;
  apartamento_id: string | null;
  fornecedor: string | null;
  data_encomenda: string; // date
  estado: EncomendaEstado;
  data_rececao: string | null; // date
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

Add this composite type in the "Tipos compostos / de UI" block (after `ProjetoComRelacoes`):

```ts
export interface EncomendaComRelacoes extends Encomenda {
  apartamento: Pick<Apartamento, "id" | "codigo" | "regiao"> | null;
  total: number; // Σ linhas (calculado)
}
```

- [ ] **Step 4: Add constants to `src/lib/constants.ts`**

Add the new types to the existing `import type { … } from "./types";` at the top:

```ts
import type {
  CustoTipo,
  EncomendaDestino,
  EncomendaEstado,
  EncomendaPagamento,
  IncidenciaEstado,
  Origem,
  Prioridade,
  ProjetoFase,
  RecorrenteTipo,
  Regiao,
  Semaforo,
} from "./types";
```

Append at the end of the file:

```ts
// ── Encomendas ───────────────────────────────────────────────────────────────
export const ENCOMENDA_DESTINO_LABEL: Record<EncomendaDestino, string> = {
  proprietario: "Proprietário",
  stock: "Stock",
  consumo: "Consumo",
};

export const ENCOMENDA_ESTADO_LABEL: Record<EncomendaEstado, string> = {
  encomendada: "Encomendada",
  recebida: "Recebida",
};

export const ENCOMENDA_PAGAMENTO_LABEL: Record<EncomendaPagamento, string> = {
  por_pagar: "Por pagar",
  pago: "Pago",
};

export const ENCOMENDA_DESTINOS: EncomendaDestino[] = [
  "proprietario",
  "stock",
  "consumo",
];
export const ENCOMENDA_ESTADOS: EncomendaEstado[] = ["encomendada", "recebida"];
export const ENCOMENDA_PAGAMENTOS: EncomendaPagamento[] = ["por_pagar", "pago"];

/** Sugestões para o campo de método de pagamento (aceita texto livre). */
export const METODOS_PAGAMENTO: string[] = [
  "Dinheiro",
  "Cartão",
  "Transferência",
  "MB Way",
];

export const ENCOMENDA_DESTINO_CLASSE: Record<EncomendaDestino, string> = {
  proprietario: "bg-blue-100 text-blue-800 border-blue-200",
  stock: "bg-violet-100 text-violet-800 border-violet-200",
  consumo: "bg-slate-100 text-slate-700 border-slate-200",
};

export const ENCOMENDA_PAGAMENTO_CLASSE: Record<EncomendaPagamento, string> = {
  por_pagar: "bg-amber-100 text-amber-800 border-amber-200",
  pago: "bg-green-100 text-green-800 border-green-200",
};
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/schema.sql src/lib/types.ts src/lib/constants.ts
git commit -m "feat(encomendas): modelo de dados + tipos + constantes"
```

---

## Task 2: Pure total helper (`encomenda.ts`) — TDD

**Files:**
- Create: `src/lib/encomenda.ts`
- Test: `src/lib/encomenda.test.ts`

**Interfaces:**
- Produces: `totalEncomenda(linhas: { quantidade: number; valor_unitario: number }[]): number`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/encomenda.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { totalEncomenda } from "@/lib/encomenda";

describe("encomenda", () => {
  it("soma quantidade × valor_unitario das linhas, a 2 casas", () => {
    expect(
      totalEncomenda([
        { quantidade: 3, valor_unitario: 12.19 },
        { quantidade: 1, valor_unitario: 5 },
      ]),
    ).toBe(41.57);
  });

  it("lista vazia = 0", () => {
    expect(totalEncomenda([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/encomenda.test.ts`
Expected: FAIL — `totalEncomenda is not a function`.

- [ ] **Step 3: Implement `src/lib/encomenda.ts`**

```ts
/** Total de uma encomenda = Σ (quantidade × valor_unitario) das linhas. */
export function totalEncomenda(
  linhas: { quantidade: number; valor_unitario: number }[],
): number {
  const total = linhas.reduce(
    (acc, l) => acc + l.quantidade * l.valor_unitario,
    0,
  );
  return Math.round(total * 100) / 100;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/encomenda.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/encomenda.ts src/lib/encomenda.test.ts
git commit -m "feat(encomendas): totalEncomenda (puro) + teste"
```

---

## Task 3: Data layer — encomendas

**Files:**
- Create: `src/lib/data/encomendas.ts`

**Interfaces:**
- Consumes: `totalEncomenda` (Task 2); `EncomendaComRelacoes`, `EncomendaLinha`, `EncomendaDestino`, `EncomendaEstado` (Task 1); `FOTOS_BUCKET` (`@/lib/supabase/admin`).
- Produces:
  - `listEncomendas(filtros?: { destino?: EncomendaDestino; estado?: EncomendaEstado }): Promise<EncomendaComRelacoes[]>`
  - `getEncomenda(id: string): Promise<EncomendaComRelacoes | null>`
  - `listLinhas(encomendaId: string): Promise<EncomendaLinha[]>`
  - `criarEncomenda(input): Promise<string>`
  - `atualizarEncomenda(id: string, patch): Promise<void>`
  - `apagarEncomenda(id: string): Promise<void>`
  - `adicionarLinha(encomendaId: string, linha: { descricao: string; quantidade: number; valor_unitario: number }): Promise<void>`
  - `atualizarLinha(id: string, patch: { descricao: string; quantidade: number; valor_unitario: number }): Promise<void>`
  - `removerLinha(id: string): Promise<void>`
  - `definirFatura(id: string, path: string): Promise<void>`
  - `removerFatura(id: string): Promise<void>`

- [ ] **Step 1: Write `src/lib/data/encomendas.ts`**

```ts
import "server-only";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { totalEncomenda } from "@/lib/encomenda";
import type {
  EncomendaComRelacoes,
  EncomendaDestino,
  EncomendaEstado,
  EncomendaLinha,
} from "@/lib/types";

const SELECT_LISTA = `
  *,
  apartamento:apartamentos ( id, codigo, regiao ),
  linhas:encomenda_linhas ( quantidade, valor_unitario )
`;

interface LinhaMin {
  quantidade: number;
  valor_unitario: number;
}

function comTotal(row: Record<string, unknown>): EncomendaComRelacoes {
  const linhas = (row.linhas as LinhaMin[] | null) ?? [];
  const enc: Record<string, unknown> = { ...row, total: totalEncomenda(linhas) };
  delete enc.linhas; // remove a prop embebida (só serve para o total)
  return enc as unknown as EncomendaComRelacoes;
}

export async function listEncomendas(filtros?: {
  destino?: EncomendaDestino;
  estado?: EncomendaEstado;
}): Promise<EncomendaComRelacoes[]> {
  let query = supabaseAdmin()
    .from("encomendas")
    .select(SELECT_LISTA)
    .order("data_encomenda", { ascending: false });
  if (filtros?.destino) query = query.eq("destino", filtros.destino);
  if (filtros?.estado) query = query.eq("estado", filtros.estado);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => comTotal(r as Record<string, unknown>));
}

export async function getEncomenda(
  id: string,
): Promise<EncomendaComRelacoes | null> {
  const { data, error } = await supabaseAdmin()
    .from("encomendas")
    .select(SELECT_LISTA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return comTotal(data as Record<string, unknown>);
}

export async function listLinhas(
  encomendaId: string,
): Promise<EncomendaLinha[]> {
  const { data, error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .select("*")
    .eq("encomenda_id", encomendaId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EncomendaLinha[];
}

export interface EncomendaInput {
  titulo?: string | null;
  destino: EncomendaDestino;
  apartamento_id?: string | null;
  fornecedor?: string | null;
  data_encomenda?: string | null;
  estado?: EncomendaEstado;
  data_rececao?: string | null;
  pagamento?: "por_pagar" | "pago";
  metodo_pagamento?: string | null;
  notas?: string | null;
}

export async function criarEncomenda(input: EncomendaInput): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("encomendas")
    .insert({
      titulo: input.titulo ?? null,
      destino: input.destino,
      apartamento_id: input.apartamento_id ?? null,
      fornecedor: input.fornecedor ?? null,
      data_encomenda: input.data_encomenda ?? undefined,
      estado: input.estado ?? undefined,
      data_rececao: input.data_rececao ?? null,
      pagamento: input.pagamento ?? undefined,
      metodo_pagamento: input.metodo_pagamento ?? null,
      notas: input.notas ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function atualizarEncomenda(
  id: string,
  patch: EncomendaInput,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomendas")
    .update({
      titulo: patch.titulo ?? null,
      destino: patch.destino,
      apartamento_id: patch.apartamento_id ?? null,
      fornecedor: patch.fornecedor ?? null,
      data_encomenda: patch.data_encomenda ?? undefined,
      estado: patch.estado ?? undefined,
      data_rececao: patch.data_rececao ?? null,
      pagamento: patch.pagamento ?? undefined,
      metodo_pagamento: patch.metodo_pagamento ?? null,
      notas: patch.notas ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function apagarEncomenda(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("encomendas")
    .select("fatura_ficheiro")
    .eq("id", id)
    .maybeSingle();
  const path = (data as { fatura_ficheiro: string | null } | null)
    ?.fatura_ficheiro;
  if (path) await db.storage.from(FOTOS_BUCKET).remove([path]);
  const { error } = await db.from("encomendas").delete().eq("id", id);
  if (error) throw error;
}

export async function adicionarLinha(
  encomendaId: string,
  linha: { descricao: string; quantidade: number; valor_unitario: number },
): Promise<void> {
  const { error } = await supabaseAdmin().from("encomenda_linhas").insert({
    encomenda_id: encomendaId,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    valor_unitario: linha.valor_unitario,
  });
  if (error) throw error;
}

export async function atualizarLinha(
  id: string,
  patch: { descricao: string; quantidade: number; valor_unitario: number },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function removerLinha(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomenda_linhas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function definirFatura(id: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("encomendas")
    .update({ fatura_ficheiro: path })
    .eq("id", id);
  if (error) throw error;
}

export async function removerFatura(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("encomendas")
    .select("fatura_ficheiro")
    .eq("id", id)
    .maybeSingle();
  const path = (data as { fatura_ficheiro: string | null } | null)
    ?.fatura_ficheiro;
  if (path) await db.storage.from(FOTOS_BUCKET).remove([path]);
  const { error } = await db
    .from("encomendas")
    .update({ fatura_ficheiro: null })
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/encomendas.ts
git commit -m "feat(encomendas): camada de dados (CRUD + linhas + fatura)"
```

---

## Task 4: Data layer — lista de compras + conversão

**Files:**
- Create: `src/lib/data/lista_compras.ts`

**Interfaces:**
- Consumes: `criarEncomenda`, `adicionarLinha` (Task 3); `ListaCompraItem`, `EncomendaDestino` (Task 1).
- Produces:
  - `listPendentes(): Promise<ListaCompraItem[]>`
  - `adicionarItem(input: { descricao: string; quantidade?: number; apartamento_id?: string | null; notas?: string | null }): Promise<void>`
  - `atualizarItem(id: string, patch: { descricao: string; quantidade: number; apartamento_id: string | null; notas: string | null }): Promise<void>`
  - `removerItem(id: string): Promise<void>`
  - `converterEmEncomenda(itemIds: string[], header: { destino: EncomendaDestino; apartamento_id?: string | null }): Promise<string>`

- [ ] **Step 1: Write `src/lib/data/lista_compras.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { criarEncomenda, adicionarLinha } from "@/lib/data/encomendas";
import type { EncomendaDestino, ListaCompraItem } from "@/lib/types";

export async function listPendentes(): Promise<ListaCompraItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("lista_compras")
    .select("*")
    .eq("comprado", false)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListaCompraItem[];
}

export async function adicionarItem(input: {
  descricao: string;
  quantidade?: number;
  apartamento_id?: string | null;
  notas?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("lista_compras").insert({
    descricao: input.descricao,
    quantidade: input.quantidade ?? 1,
    apartamento_id: input.apartamento_id ?? null,
    notas: input.notas ?? null,
  });
  if (error) throw error;
}

export async function atualizarItem(
  id: string,
  patch: {
    descricao: string;
    quantidade: number;
    apartamento_id: string | null;
    notas: string | null;
  },
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("lista_compras")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function removerItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("lista_compras")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Converte itens pendentes numa única encomenda (uma linha por item). */
export async function converterEmEncomenda(
  itemIds: string[],
  header: { destino: EncomendaDestino; apartamento_id?: string | null },
): Promise<string> {
  if (itemIds.length === 0) throw new Error("Sem itens selecionados.");
  const db = supabaseAdmin();

  const { data: itens, error: errLer } = await db
    .from("lista_compras")
    .select("id, descricao, quantidade")
    .in("id", itemIds)
    .eq("comprado", false);
  if (errLer) throw errLer;
  const linhas = (itens ?? []) as {
    id: string;
    descricao: string;
    quantidade: number;
  }[];
  if (linhas.length === 0) throw new Error("Itens já convertidos.");

  const encomendaId = await criarEncomenda({
    destino: header.destino,
    apartamento_id: header.apartamento_id ?? null,
  });

  for (const l of linhas) {
    await adicionarLinha(encomendaId, {
      descricao: l.descricao,
      quantidade: l.quantidade,
      valor_unitario: 0,
    });
  }

  const { error: errUpd } = await db
    .from("lista_compras")
    .update({ comprado: true, encomenda_id: encomendaId })
    .in(
      "id",
      linhas.map((l) => l.id),
    );
  if (errUpd) throw errUpd;

  return encomendaId;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/lista_compras.ts
git commit -m "feat(encomendas): lista de compras + converter em encomenda"
```

---

## Task 5: Server actions

**Files:**
- Create: `src/app/(app)/encomendas/actions.ts`

**Interfaces:**
- Consumes: all data-layer functions from Tasks 3 & 4; `FOTOS_BUCKET` (`@/lib/supabase/admin`); `exigirSessao` (`@/lib/session`).
- Produces: `criarEncomenda`, `atualizarEncomenda`, `apagarEncomenda`, `adicionarLinha`, `atualizarLinha`, `removerLinha`, `uploadFatura`, `removerFatura`, `adicionarItemLista`, `atualizarItemLista`, `removerItemLista`, `criarEncomendaDeItens` (all `(formData: FormData) => Promise<void>`, some redirecting).

- [ ] **Step 1: Write `src/app/(app)/encomendas/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, FOTOS_BUCKET } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import * as dataEnc from "@/lib/data/encomendas";
import * as dataLista from "@/lib/data/lista_compras";
import type { EncomendaDestino, EncomendaEstado } from "@/lib/types";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOuNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lerCabecalho(formData: FormData): dataEnc.EncomendaInput {
  return {
    titulo: strOuNull(formData.get("titulo")),
    destino: (str(formData.get("destino")) || "consumo") as EncomendaDestino,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    fornecedor: strOuNull(formData.get("fornecedor")),
    data_encomenda: strOuNull(formData.get("data_encomenda")),
    estado: (str(formData.get("estado")) || "encomendada") as EncomendaEstado,
    data_rececao: strOuNull(formData.get("data_rececao")),
    pagamento: str(formData.get("pagamento")) === "pago" ? "pago" : "por_pagar",
    metodo_pagamento: strOuNull(formData.get("metodo_pagamento")),
    notas: strOuNull(formData.get("notas")),
  };
}

// ── Encomenda (cabeçalho) ─────────────────────────────────────────────────────
export async function criarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = await dataEnc.criarEncomenda(lerCabecalho(formData));
  revalidatePath("/encomendas");
  redirect(`/encomendas/${id}`);
}

export async function atualizarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.atualizarEncomenda(id, lerCabecalho(formData));
  revalidatePath(`/encomendas/${id}`);
  revalidatePath("/encomendas");
}

export async function apagarEncomenda(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.apagarEncomenda(id);
  revalidatePath("/encomendas");
  redirect("/encomendas");
}

// ── Linhas ────────────────────────────────────────────────────────────────────
export async function adicionarLinha(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  if (!encomendaId) throw new Error("encomenda_id em falta");
  await dataEnc.adicionarLinha(encomendaId, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    valor_unitario: num(formData.get("valor_unitario")),
  });
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function atualizarLinha(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const encomendaId = str(formData.get("encomenda_id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.atualizarLinha(id, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")),
    valor_unitario: num(formData.get("valor_unitario")),
  });
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function removerLinha(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  const encomendaId = str(formData.get("encomenda_id"));
  if (!id) throw new Error("id em falta");
  await dataEnc.removerLinha(id);
  revalidatePath(`/encomendas/${encomendaId}`);
}

// ── Fatura ────────────────────────────────────────────────────────────────────
export async function uploadFatura(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  const file = formData.get("file");
  if (!encomendaId || !(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const ext = file.name.split(".").pop() || "pdf";
  const path = `encomendas/${encomendaId}/fatura-${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: errUp } = await supabaseAdmin()
    .storage.from(FOTOS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/pdf" });
  if (errUp) throw errUp;
  await dataEnc.definirFatura(encomendaId, path);
  revalidatePath(`/encomendas/${encomendaId}`);
}

export async function removerFatura(formData: FormData) {
  await exigirSessao();
  const encomendaId = str(formData.get("encomenda_id"));
  if (!encomendaId) throw new Error("encomenda_id em falta");
  await dataEnc.removerFatura(encomendaId);
  revalidatePath(`/encomendas/${encomendaId}`);
}

// ── Lista de compras ──────────────────────────────────────────────────────────
export async function adicionarItemLista(formData: FormData) {
  await exigirSessao();
  const descricao = str(formData.get("descricao"));
  if (!descricao) throw new Error("Descrição em falta.");
  await dataLista.adicionarItem({
    descricao,
    quantidade: num(formData.get("quantidade")) || 1,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    notas: strOuNull(formData.get("notas")),
  });
  revalidatePath("/encomendas");
}

export async function atualizarItemLista(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataLista.atualizarItem(id, {
    descricao: str(formData.get("descricao")) || "—",
    quantidade: num(formData.get("quantidade")) || 1,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
    notas: strOuNull(formData.get("notas")),
  });
  revalidatePath("/encomendas");
}

export async function removerItemLista(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");
  await dataLista.removerItem(id);
  revalidatePath("/encomendas");
}

export async function criarEncomendaDeItens(formData: FormData) {
  await exigirSessao();
  const itemIds = formData.getAll("itemIds").map((v) => String(v));
  if (itemIds.length === 0) throw new Error("Sem itens selecionados.");
  const id = await dataLista.converterEmEncomenda(itemIds, {
    destino: (str(formData.get("destino")) || "consumo") as EncomendaDestino,
    apartamento_id: strOuNull(formData.get("apartamento_id")),
  });
  revalidatePath("/encomendas");
  redirect(`/encomendas/${id}`);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/encomendas/actions.ts"
git commit -m "feat(encomendas): server actions"
```

---

## Task 6: Sidebar nav + `/encomendas` page (orders list)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/app/(app)/encomendas/page.tsx`

**Interfaces:**
- Consumes: `listEncomendas` (Task 3); `listPendentes` (Task 4); `formatEuro`, `formatData`; `Badge`; encomenda label/class constants (Task 1).
- Produces: `/encomendas` route showing the orders list (shopping list added in Task 7).

- [ ] **Step 1: Add the nav entry in `src/components/Sidebar.tsx`**

In the `LINKS` array, add after the `projetos` entry:

```ts
  { href: "/encomendas", label: "Encomendas", icon: "📦" },
```

- [ ] **Step 2: Write `src/app/(app)/encomendas/page.tsx`**

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { Badge } from "@/components/ui/Badge";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listEncomendas } from "@/lib/data/encomendas";
import { listPendentes } from "@/lib/data/lista_compras";
import { formatData, formatEuro } from "@/lib/format";
import {
  ENCOMENDA_DESTINO_CLASSE,
  ENCOMENDA_DESTINO_LABEL,
  ENCOMENDA_ESTADO_LABEL,
  ENCOMENDA_PAGAMENTO_CLASSE,
  ENCOMENDA_PAGAMENTO_LABEL,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function EncomendasPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Encomendas" />
        <SetupNotice />
      </>
    );
  }

  const [encomendas, pendentes] = await Promise.all([
    listEncomendas(),
    listPendentes(),
  ]);
  void pendentes; // usado na Task 7 (lista de compras)

  return (
    <>
      <PageHeader
        titulo="Encomendas"
        descricao="Compras da empresa — proprietário, stock ou consumo. Fora do P&L."
        acao={
          <Link href="/encomendas/nova" className="btn-primary">
            + Nova encomenda
          </Link>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Encomendas</h2>
        {encomendas.length === 0 ? (
          <EmptyState
            titulo="Sem encomendas"
            descricao="Ainda não registaste nenhuma compra."
          />
        ) : (
          <div className="space-y-2">
            {encomendas.map((e) => (
              <Link
                key={e.id}
                href={`/encomendas/${e.id}`}
                className="card flex items-center justify-between gap-3 p-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {e.titulo || e.fornecedor || "Encomenda"}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {formatData(e.data_encomenda)}
                    {e.apartamento ? ` · ${e.apartamento.codigo}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge className={ENCOMENDA_DESTINO_CLASSE[e.destino]}>
                    {ENCOMENDA_DESTINO_LABEL[e.destino]}
                  </Badge>
                  <Badge className={ENCOMENDA_PAGAMENTO_CLASSE[e.pagamento]}>
                    {ENCOMENDA_PAGAMENTO_LABEL[e.pagamento]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {ENCOMENDA_ESTADO_LABEL[e.estado]}
                  </span>
                  <span className="w-20 text-right text-sm font-semibold text-slate-900">
                    {formatEuro(e.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → "Encomendas" appears in the sidebar → `/encomendas` renders (empty state until orders exist).

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx "src/app/(app)/encomendas/page.tsx"
git commit -m "feat(encomendas): nav + lista de encomendas"
```

---

## Task 7: Shopping list (capture + multi-select + convert)

**Files:**
- Create: `src/app/(app)/encomendas/ListaCompras.tsx`
- Modify: `src/app/(app)/encomendas/page.tsx`

**Interfaces:**
- Consumes: `adicionarItemLista`, `removerItemLista`, `criarEncomendaDeItens` (Task 5); `ListaCompraItem` (Task 1); `ENCOMENDA_DESTINOS`, `ENCOMENDA_DESTINO_LABEL` (Task 1); `listApartamentosSelect` (`@/lib/data/apartamentos`).
- Produces: `ListaCompras({ itens, apartamentos })` client component.

- [ ] **Step 1: Write `src/app/(app)/encomendas/ListaCompras.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarItemLista,
  removerItemLista,
  criarEncomendaDeItens,
} from "./actions";
import { ENCOMENDA_DESTINOS, ENCOMENDA_DESTINO_LABEL } from "@/lib/constants";
import type { EncomendaDestino, ListaCompraItem } from "@/lib/types";

type ApSelect = { id: string; codigo: string };

export function ListaCompras({
  itens,
  apartamentos,
}: {
  itens: ListaCompraItem[];
  apartamentos: ApSelect[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [descricao, setDescricao] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [aConverter, setAConverter] = useState(false);
  const [destino, setDestino] = useState<EncomendaDestino>("consumo");
  const [apartamentoId, setApartamentoId] = useState("");

  const selecionados = itens.filter((i) => sel[i.id]).map((i) => i.id);

  function adicionar() {
    if (!descricao.trim()) return;
    const fd = new FormData();
    fd.set("descricao", descricao);
    startTransition(async () => {
      await adicionarItemLista(fd);
      setDescricao("");
      router.refresh();
    });
  }

  function remover(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await removerItemLista(fd);
      router.refresh();
    });
  }

  function converter() {
    if (selecionados.length === 0) return;
    const fd = new FormData();
    for (const id of selecionados) fd.append("itemIds", id);
    fd.set("destino", destino);
    if (destino === "proprietario") fd.set("apartamento_id", apartamentoId);
    startTransition(async () => {
      await criarEncomendaDeItens(fd); // redireciona para o detalhe
    });
  }

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        Lista de compras
      </h2>

      {/* Captura rápida */}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="+ adicionar item (ex.: carregador hotspot)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") adicionar();
          }}
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={pending || !descricao.trim()}
          className="btn-primary shrink-0"
        >
          Adicionar
        </button>
      </div>

      {/* Itens pendentes */}
      {itens.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Lista vazia. Vai apontando o que precisas de comprar.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(sel[i.id])}
                onChange={(e) => setSel((s) => ({ ...s, [i.id]: e.target.checked }))}
              />
              <span className="flex-1 text-slate-700">
                {i.quantidade > 1 ? `${i.quantidade}× ` : ""}
                {i.descricao}
              </span>
              <button
                type="button"
                onClick={() => remover(i.id)}
                disabled={pending}
                className="text-xs text-red-600 hover:underline"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Converter selecionados */}
      {itens.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {!aConverter ? (
            <button
              type="button"
              onClick={() => setAConverter(true)}
              disabled={selecionados.length === 0}
              className="btn-secondary text-xs"
            >
              Criar encomenda dos selecionados ({selecionados.length})
            </button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">Destino</label>
                <select
                  className="input"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value as EncomendaDestino)}
                >
                  {ENCOMENDA_DESTINOS.map((d) => (
                    <option key={d} value={d}>
                      {ENCOMENDA_DESTINO_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
              {destino === "proprietario" ? (
                <div>
                  <label className="label">Apartamento</label>
                  <select
                    className="input"
                    value={apartamentoId}
                    onChange={(e) => setApartamentoId(e.target.value)}
                  >
                    <option value="">—</option>
                    {apartamentos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <button
                type="button"
                onClick={converter}
                disabled={pending || selecionados.length === 0}
                className="btn-primary text-xs"
              >
                Criar encomenda
              </button>
              <button
                type="button"
                onClick={() => setAConverter(false)}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Render `ListaCompras` in the page**

In `src/app/(app)/encomendas/page.tsx`:

Add imports:

```ts
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { ListaCompras } from "./ListaCompras";
```

Replace the `listEncomendas` + `listPendentes` block with a three-way fetch and drop the `void pendentes;` line:

```ts
  const [encomendas, pendentes, apartamentos] = await Promise.all([
    listEncomendas(),
    listPendentes(),
    listApartamentosSelect(),
  ]);
```

Insert the shopping list above the orders `<section>`:

```tsx
      <div className="mb-6">
        <ListaCompras
          itens={pendentes}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />
      </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → `/encomendas`: add a couple of items; tick one or more; "Criar encomenda dos selecionados" → pick destino → "Criar encomenda" → redirected to the new order's detail; the items leave the pending list.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/encomendas/ListaCompras.tsx" "src/app/(app)/encomendas/page.tsx"
git commit -m "feat(encomendas): lista de compras (captura + converter em encomenda)"
```

---

## Task 8: Encomenda header form + `/encomendas/nova`

**Files:**
- Create: `src/app/(app)/encomendas/EncomendaForm.tsx`
- Create: `src/app/(app)/encomendas/nova/page.tsx`

**Interfaces:**
- Consumes: `criarEncomenda`, `atualizarEncomenda` (Task 5); `Encomenda` (Task 1); constants `ENCOMENDA_DESTINOS`/`ENCOMENDA_ESTADOS`/`ENCOMENDA_PAGAMENTOS`/`*_LABEL`/`METODOS_PAGAMENTO`; `listApartamentosSelect`.
- Produces: `EncomendaForm({ inicial, apartamentos })` client component (create when `inicial` has no `id`, edit otherwise).

- [ ] **Step 1: Write `src/app/(app)/encomendas/EncomendaForm.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarEncomenda, atualizarEncomenda } from "./actions";
import {
  ENCOMENDA_DESTINOS,
  ENCOMENDA_DESTINO_LABEL,
  ENCOMENDA_ESTADOS,
  ENCOMENDA_ESTADO_LABEL,
  ENCOMENDA_PAGAMENTOS,
  ENCOMENDA_PAGAMENTO_LABEL,
  METODOS_PAGAMENTO,
} from "@/lib/constants";
import type {
  Encomenda,
  EncomendaDestino,
  EncomendaEstado,
  EncomendaPagamento,
} from "@/lib/types";

type ApSelect = { id: string; codigo: string };

export function EncomendaForm({
  inicial,
  apartamentos,
}: {
  inicial: Partial<Encomenda> & { id?: string };
  apartamentos: ApSelect[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editar = Boolean(inicial.id);

  const [f, setF] = useState({
    titulo: inicial.titulo ?? "",
    destino: (inicial.destino ?? "consumo") as EncomendaDestino,
    apartamento_id: inicial.apartamento_id ?? "",
    fornecedor: inicial.fornecedor ?? "",
    data_encomenda: inicial.data_encomenda ?? "",
    estado: (inicial.estado ?? "encomendada") as EncomendaEstado,
    data_rececao: inicial.data_rececao ?? "",
    pagamento: (inicial.pagamento ?? "por_pagar") as EncomendaPagamento,
    metodo_pagamento: inicial.metodo_pagamento ?? "",
    notas: inicial.notas ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));

  function guardar() {
    const fd = new FormData();
    if (inicial.id) fd.set("id", inicial.id);
    fd.set("titulo", f.titulo);
    fd.set("destino", f.destino);
    if (f.destino === "proprietario") fd.set("apartamento_id", f.apartamento_id);
    fd.set("fornecedor", f.fornecedor);
    fd.set("data_encomenda", f.data_encomenda);
    fd.set("estado", f.estado);
    fd.set("data_rececao", f.data_rececao);
    fd.set("pagamento", f.pagamento);
    fd.set("metodo_pagamento", f.metodo_pagamento);
    fd.set("notas", f.notas);
    startTransition(async () => {
      if (editar) {
        await atualizarEncomenda(fd);
        router.refresh();
      } else {
        await criarEncomenda(fd); // redireciona para o detalhe
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={f.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
            placeholder="ex.: carregadores hotspot"
          />
        </div>
        <div>
          <label className="label">Fornecedor</label>
          <input
            className="input"
            value={f.fornecedor}
            onChange={(e) => set({ fornecedor: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Destino</label>
          <select
            className="input"
            value={f.destino}
            onChange={(e) => set({ destino: e.target.value as EncomendaDestino })}
          >
            {ENCOMENDA_DESTINOS.map((d) => (
              <option key={d} value={d}>
                {ENCOMENDA_DESTINO_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        {f.destino === "proprietario" ? (
          <div>
            <label className="label">Apartamento</label>
            <select
              className="input"
              value={f.apartamento_id}
              onChange={(e) => set({ apartamento_id: e.target.value })}
            >
              <option value="">—</option>
              {apartamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div>
          <label className="label">Data da encomenda</label>
          <input
            type="date"
            className="input"
            value={f.data_encomenda}
            onChange={(e) => set({ data_encomenda: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Estado</label>
          <select
            className="input"
            value={f.estado}
            onChange={(e) => set({ estado: e.target.value as EncomendaEstado })}
          >
            {ENCOMENDA_ESTADOS.map((s) => (
              <option key={s} value={s}>
                {ENCOMENDA_ESTADO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Data de receção</label>
          <input
            type="date"
            className="input"
            value={f.data_rececao}
            onChange={(e) => set({ data_rececao: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Pagamento</label>
          <select
            className="input"
            value={f.pagamento}
            onChange={(e) =>
              set({ pagamento: e.target.value as EncomendaPagamento })
            }
          >
            {ENCOMENDA_PAGAMENTOS.map((p) => (
              <option key={p} value={p}>
                {ENCOMENDA_PAGAMENTO_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Método de pagamento</label>
          <input
            className="input"
            list="metodos-pagamento"
            value={f.metodo_pagamento}
            onChange={(e) => set({ metodo_pagamento: e.target.value })}
            placeholder="Dinheiro / Cartão / …"
          />
          <datalist id="metodos-pagamento">
            {METODOS_PAGAMENTO.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea
          className="input h-20 resize-y"
          value={f.notas}
          onChange={(e) => set({ notas: e.target.value })}
        />
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={guardar} disabled={pending}>
          {pending ? "A guardar…" : editar ? "Guardar" : "Criar encomenda"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/(app)/encomendas/nova/page.tsx`**

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { EncomendaForm } from "../EncomendaForm";

export const dynamic = "force-dynamic";

export default async function NovaEncomendaPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Nova encomenda" />
        <SetupNotice />
      </>
    );
  }

  const apartamentos = await listApartamentosSelect();

  return (
    <>
      <PageHeader
        titulo="Nova encomenda"
        descricao="Depois de criar, adiciona os artigos e a fatura no detalhe."
        acao={
          <Link href="/encomendas" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl">
        <EncomendaForm
          inicial={{}}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → `/encomendas` → "+ Nova encomenda" → fill the header → "Criar encomenda" → redirected to the (empty) detail page (built in Task 9).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/encomendas/EncomendaForm.tsx" "src/app/(app)/encomendas/nova/page.tsx"
git commit -m "feat(encomendas): formulario de cabecalho + nova encomenda"
```

---

## Task 9: Order detail page (header edit + delete)

**Files:**
- Create: `src/app/(app)/encomendas/[id]/page.tsx`

**Interfaces:**
- Consumes: `getEncomenda`, `listLinhas` (Task 3); `apagarEncomenda` (Task 5); `EncomendaForm` (Task 8); `listApartamentosSelect`; `formatEuro`.
- Produces: `/encomendas/[id]` route (line editor + fatura added in Tasks 10 & 11).

- [ ] **Step 1: Write `src/app/(app)/encomendas/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { getEncomenda, listLinhas } from "@/lib/data/encomendas";
import { listApartamentosSelect } from "@/lib/data/apartamentos";
import { formatEuro } from "@/lib/format";
import { EncomendaForm } from "../EncomendaForm";
import { apagarEncomenda } from "../actions";

export const dynamic = "force-dynamic";

export default async function EncomendaDetalhe({
  params,
}: {
  params: { id: string };
}) {
  if (!supabaseConfigurado()) return notFound();

  const enc = await getEncomenda(params.id);
  if (!enc) notFound();

  const [linhas, apartamentos] = await Promise.all([
    listLinhas(enc.id),
    listApartamentosSelect(),
  ]);
  void linhas; // usado na Task 10 (editor de linhas)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo={enc.titulo || enc.fornecedor || "Encomenda"}
        descricao={`Total ${formatEuro(enc.total)}`}
        acao={
          <Link href="/encomendas" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      <div className="space-y-6">
        <EncomendaForm
          inicial={enc}
          apartamentos={apartamentos.map((a) => ({ id: a.id, codigo: a.codigo }))}
        />

        <form action={apagarEncomenda} className="flex justify-end">
          <input type="hidden" name="id" value={enc.id} />
          <button type="submit" className="text-xs text-red-600 hover:underline">
            Apagar encomenda
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

`npm run dev` → open an order → header loads and edits (Guardar persists); "Apagar encomenda" removes it and returns to `/encomendas`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/encomendas/[id]/page.tsx"
git commit -m "feat(encomendas): detalhe (cabecalho + apagar)"
```

---

## Task 10: Line-items editor

**Files:**
- Create: `src/app/(app)/encomendas/[id]/EncomendaLinhasEditor.tsx`
- Modify: `src/app/(app)/encomendas/[id]/page.tsx`

**Interfaces:**
- Consumes: `adicionarLinha`, `atualizarLinha`, `removerLinha` (Task 5); `EncomendaLinha` (Task 1); `formatEuro`, `totalLinha`.
- Produces: `EncomendaLinhasEditor({ encomendaId, linhas })` client component.

- [ ] **Step 1: Write `src/app/(app)/encomendas/[id]/EncomendaLinhasEditor.tsx`**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarLinha, atualizarLinha, removerLinha } from "../actions";
import { formatEuro, totalLinha } from "@/lib/format";
import type { EncomendaLinha } from "@/lib/types";

export function EncomendaLinhasEditor({
  encomendaId,
  linhas,
}: {
  encomendaId: string;
  linhas: EncomendaLinha[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<EncomendaLinha[]>(linhas);
  useEffect(() => setRows(linhas), [linhas]);

  const [novo, setNovo] = useState({
    descricao: "",
    quantidade: "1",
    valor_unitario: "0",
  });

  const total = rows.reduce(
    (a, r) => a + totalLinha(r.quantidade, r.valor_unitario),
    0,
  );

  function patchRow(id: string, patch: Partial<EncomendaLinha>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function guardar(row: EncomendaLinha) {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("encomenda_id", encomendaId);
    fd.set("descricao", row.descricao);
    fd.set("quantidade", String(row.quantidade));
    fd.set("valor_unitario", String(row.valor_unitario));
    startTransition(async () => {
      await atualizarLinha(fd);
      router.refresh();
    });
  }

  function remover(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("encomenda_id", encomendaId);
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(async () => {
      await removerLinha(fd);
      router.refresh();
    });
  }

  function adicionar() {
    if (!novo.descricao.trim()) return;
    const fd = new FormData();
    fd.set("encomenda_id", encomendaId);
    fd.set("descricao", novo.descricao);
    fd.set("quantidade", novo.quantidade || "1");
    fd.set("valor_unitario", novo.valor_unitario || "0");
    startTransition(async () => {
      await adicionarLinha(fd);
      setNovo({ descricao: "", quantidade: "1", valor_unitario: "0" });
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Artigos</h3>
        <span className="text-sm font-semibold text-slate-900">
          Total: {formatEuro(total)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">Descrição</th>
              <th className="th w-24">Qtd</th>
              <th className="th w-28">€/un</th>
              <th className="th w-24 text-right">Total</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td">
                  <input
                    className="input py-1"
                    value={r.descricao}
                    onChange={(e) => patchRow(r.id, { descricao: e.target.value })}
                  />
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="0.01"
                    className="input py-1 text-right"
                    value={r.quantidade}
                    onChange={(e) =>
                      patchRow(r.id, { quantidade: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="0.01"
                    className="input py-1 text-right"
                    value={r.valor_unitario}
                    onChange={(e) =>
                      patchRow(r.id, { valor_unitario: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="td text-right font-medium">
                  {formatEuro(totalLinha(r.quantidade, r.valor_unitario))}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => guardar(r)}
                      disabled={pending}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(r.id)}
                      disabled={pending}
                      className="px-2 py-1 text-xs text-red-600 hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            <tr className="bg-slate-50">
              <td className="td">
                <input
                  className="input py-1"
                  placeholder="Descrição…"
                  value={novo.descricao}
                  onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                />
              </td>
              <td className="td">
                <input
                  type="number"
                  step="0.01"
                  className="input py-1 text-right"
                  value={novo.quantidade}
                  onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })}
                />
              </td>
              <td className="td">
                <input
                  type="number"
                  step="0.01"
                  className="input py-1 text-right"
                  value={novo.valor_unitario}
                  onChange={(e) =>
                    setNovo({ ...novo, valor_unitario: e.target.value })
                  }
                />
              </td>
              <td className="td text-right font-medium text-slate-400">
                {formatEuro(
                  totalLinha(
                    Number(novo.quantidade) || 0,
                    Number(novo.valor_unitario) || 0,
                  ),
                )}
              </td>
              <td className="td">
                <button
                  type="button"
                  onClick={adicionar}
                  disabled={pending || !novo.descricao.trim()}
                  className="btn-primary px-2 py-1 text-xs"
                >
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it in the detail page**

In `src/app/(app)/encomendas/[id]/page.tsx`:

Add the import:

```ts
import { EncomendaLinhasEditor } from "./EncomendaLinhasEditor";
```

Remove the `void linhas;` line, and insert the editor between `<EncomendaForm … />` and the delete `<form>`:

```tsx
        <EncomendaLinhasEditor encomendaId={enc.id} linhas={linhas} />
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → open an order → add/edit/remove line items; the "Total" updates and the header "Total …" reflects it after refresh. Items created from the shopping list appear here with `€/un = 0`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/encomendas/[id]/EncomendaLinhasEditor.tsx" "src/app/(app)/encomendas/[id]/page.tsx"
git commit -m "feat(encomendas): editor de artigos (linhas)"
```

---

## Task 11: Invoice (fatura) upload

**Files:**
- Create: `src/app/(app)/encomendas/[id]/FaturaPanel.tsx`
- Modify: `src/app/(app)/encomendas/[id]/page.tsx`

**Interfaces:**
- Consumes: `uploadFatura`, `removerFatura` (Task 5); `signedUrl` (`@/lib/data/storage`).
- Produces: `FaturaPanel({ encomendaId, url })` component (uses server actions directly via `<form action=…>`).

- [ ] **Step 1: Write `src/app/(app)/encomendas/[id]/FaturaPanel.tsx`**

```tsx
import { uploadFatura, removerFatura } from "../actions";

export function FaturaPanel({
  encomendaId,
  url,
}: {
  encomendaId: string;
  url: string | null;
}) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Fatura</h3>

      {url ? (
        <div className="mb-3 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            📄 Ver fatura
          </a>
          <form action={removerFatura}>
            <input type="hidden" name="encomenda_id" value={encomendaId} />
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Remover
            </button>
          </form>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-500">Sem fatura anexada.</p>
      )}

      <form action={uploadFatura} className="space-y-2">
        <input type="hidden" name="encomenda_id" value={encomendaId} />
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
        />
        <button type="submit" className="btn-secondary w-full text-xs">
          Carregar fatura
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Render it in the detail page**

In `src/app/(app)/encomendas/[id]/page.tsx`:

Add imports:

```ts
import { signedUrl } from "@/lib/data/storage";
import { FaturaPanel } from "./FaturaPanel";
```

Add `signedUrl(enc.fatura_ficheiro)` to the `Promise.all` and destructure it:

```ts
  const [linhas, apartamentos, faturaUrl] = await Promise.all([
    listLinhas(enc.id),
    listApartamentosSelect(),
    signedUrl(enc.fatura_ficheiro),
  ]);
```

Insert the panel after the line editor and before the delete form:

```tsx
        <FaturaPanel encomendaId={enc.id} url={faturaUrl} />
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → open an order → upload a PDF/image invoice → "Ver fatura" opens the signed URL; "Remover" clears it.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/encomendas/[id]/FaturaPanel.tsx" "src/app/(app)/encomendas/[id]/page.tsx"
git commit -m "feat(encomendas): anexar fatura"
```

---

## Final verification

- [ ] `npm test` → all pass (existing + new `encomenda` describe).
- [ ] `npm run typecheck` → clean.
- [ ] `npm run lint` → clean (or pre-existing warnings only).
- [ ] End-to-end smoke: add shopping-list items → convert a selection into an order → in the order, fill prices, mark "Recebida" with a reception date, set pagamento "Pago" + método, attach an invoice → the order shows in `/encomendas` with the right badges and total → confirm nothing appears in `/rentabilidade` or any incidência/projeto P&L.
