# Rentabilidade (Workometer) + Agendar Incidências — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-técnico/per-day profitability view (P&L) over existing incidências and projetos, plus the ability to schedule an incidência to a future day so it lands on the right day in the Agenda.

**Architecture:** No new `intervencoes` entity — the P&L is a pure TS calculation layer (`src/lib/custo.ts`) fed by the existing `incidencias` (+ material cost lines) and `projetos` (+ cost lines) tables, aggregated in the data layer (`src/lib/data/rentabilidade.ts`). A single-row `config` table holds the payroll surcharge and the standard working day. Scheduling adds one `agendada_em` column; the agenda places incidências at `COALESCE(agendada_em, aberta_em::date)`.

**Tech Stack:** Next.js 14 (App Router, Server Components + Server Actions), TypeScript, Supabase (`supabaseAdmin` service-role, server-only), TailwindCSS, Vitest (pure-logic tests only).

## Global Constraints

- **Language/copy:** all UI copy in **PT-PT** (matches the codebase).
- **Money:** every euro value **rounded to 2 decimals**; reuse the `Math.round(x*100)/100` idiom already in `custo.ts`.
- **Loaded cost is Workometer-only:** the "Registo para a empresa" card (`registo.ts`) stays on the **base** `custo_hora`. Do **not** modify `registo.ts` or `construirRegisto`.
- **Anti-double-count:** for incidência P&L, materials = **only** `incidencia_custos` with `tipo='material'`. Labour = `tempo_minutos × custo_hora_carregado`; travel = `deslocacao_valor`. Ignore `mao_obra`/`deslocacao` cost lines.
- **Projetos P&L:** cost = `Σ projeto_custos` (all types); revenue = `orcamento_valor`; realized when `fase='concluido'`.
- **Effective agenda date:** `COALESCE(agendada_em, aberta_em::date)`; unscheduled incidências stay visible on their creation day (no regression).
- **Data layer:** every file that touches Supabase starts with `import "server-only";` and uses `supabaseAdmin()`. Server actions call `await exigirSessao()` first and `revalidatePath(...)` after writes.
- **No new dependencies.** Reuse `formatEuro`, `formatData`, `toISODate`, `inicioDaSemana`, `adicionarDias` from `src/lib/format.ts` and the `card`/`input`/`label`/`btn-primary`/`btn-secondary`/`th`/`td` Tailwind classes.
- **Verification gate for non-test tasks:** `npm run typecheck` must pass (script = `tsc --noEmit`).

---

## File Structure

**Create:**
- `src/lib/data/config.ts` — read/update the single `config` row.
- `src/lib/data/rentabilidade.ts` — P&L aggregation (day summary, per-item P&L, unprofitable list).
- `src/app/(app)/rentabilidade/page.tsx` — daily dashboard (Server Component).
- `src/app/(app)/rentabilidade/SeletorData.tsx` — client date picker that navigates.
- `src/app/(app)/rentabilidade/CartaoTecnico.tsx` — per-técnico result card (presentational).
- `src/app/(app)/rentabilidade/actions.ts` — `guardarConfig`.
- `src/app/(app)/rentabilidade/config/page.tsx` — config editor.
- `src/components/PLBreakdown.tsx` — reusable P&L breakdown card (incidência + projeto).

**Modify:**
- `db/schema.sql` — `config` table, `preco_proprietario`, `agendada_em`.
- `src/lib/types.ts` — `Config`; `preco_proprietario` + `agendada_em` on `Incidencia`.
- `src/lib/custo.ts` (+ `src/lib/custo.test.ts`) — pure P&L functions.
- `src/components/Sidebar.tsx` — "Rentabilidade" nav entry.
- `src/lib/data/agenda.ts` — effective date for incidências.
- `src/app/(app)/incidencias/actions.ts` — persist `preco_proprietario` + `agendada_em`.
- `src/app/(app)/incidencias/[id]/IncidenciaEditor.tsx` — two new fields.
- `src/app/(app)/incidencias/[id]/page.tsx` — P&L card.
- `src/app/(app)/projetos/[id]/page.tsx` — P&L card.
- `src/app/(app)/incidencias/nova/NovaIncidenciaForm.tsx` — optional "Agendar para".

---

## Task 1: Data model — `config` table + incidência columns

**Files:**
- Modify: `db/schema.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `config` table (`taxa_encargos_pct`, `horas_dia_padrao`, `moeda`); `incidencias.preco_proprietario numeric(10,2)`, `incidencias.agendada_em date`; TS `Config` interface; `Incidencia.preco_proprietario: number | null`, `Incidencia.agendada_em: string | null`.

- [x] **Step 1: Add the `config` table to `db/schema.sql`**

Insert this block immediately after the `tecnicos` table definition (after its closing `);`, around line 65):

```sql
-- ── config (linha única — encargos + break-even do Workometer) ───────────────
create table if not exists config (
  id                int primary key default 1,
  taxa_encargos_pct numeric(5,2) not null default 23.75,
  horas_dia_padrao  numeric(4,2) not null default 8.00,
  moeda             text not null default 'EUR',
  atualizado_em     timestamptz not null default now(),
  check (id = 1)
);
insert into config (id) values (1) on conflict (id) do nothing;
```

- [x] **Step 2: Add the two incidência columns to `db/schema.sql`**

Find the existing block (around line 113):

```sql
-- trabalho e deslocação (fecho de incidência / registo para a empresa)
alter table incidencias add column if not exists tempo_minutos int;
alter table incidencias add column if not exists deslocacao_modo text;
alter table incidencias add column if not exists deslocacao_valor numeric(10,2);
```

Append two lines right after it:

```sql
-- rentabilidade + agendamento (Workometer)
alter table incidencias add column if not exists preco_proprietario numeric(10,2);
alter table incidencias add column if not exists agendada_em date;
```

- [ ] **Step 3: Apply the SQL in Supabase** — ⚠️ PENDENTE (manual): correr as três novas instruções (config table + insert + dois alters) no SQL Editor do Supabase. Não executável nesta sessão não-interativa; idempotente (`if not exists` / `on conflict do nothing`).

- [x] **Step 4: Add the `Config` type and incidência fields in `src/lib/types.ts`**

Add the `Config` interface after the `Apartamento` interface (or anywhere in the "Tabelas" block):

```ts
export interface Config {
  id: number;
  taxa_encargos_pct: number;
  horas_dia_padrao: number;
  moeda: string;
  atualizado_em: string;
}
```

In the `Incidencia` interface, add two fields next to `deslocacao_valor`:

```ts
  deslocacao_valor: number | null;
  preco_proprietario: number | null;
  agendada_em: string | null; // date, YYYY-MM-DD
```

`IncidenciaComRelacoes extends Incidencia`, so it inherits both — no change needed there.

- [x] **Step 5: Verify types compile**

Run: `npm run typecheck`
Expected: PASS (no errors). New fields are additive; existing reads still compile.

- [x] **Step 6: Commit**

```bash
git add db/schema.sql src/lib/types.ts
git commit -m "feat(model): config table + preco_proprietario/agendada_em em incidencias"
```

---

## Task 2: P&L calculation layer (`custo.ts`) — TDD

**Files:**
- Modify: `src/lib/custo.ts`
- Test: `src/lib/custo.test.ts`

**Interfaces:**
- Consumes: existing `maoDeObra(tempoMinutos, custoHora)` from the same file.
- Produces:
  - `interface PL { custoTempo; custoDeslocacao; custoMateriais; custoTotal; receita; rentabilidade }` (all `number`).
  - `interface ResumoDia { receita; custoTotal; resultado; nIntervencoes; minutosProdutivos; custoFixoDia; ocupacaoPct; breakEvenPct }` (all `number`).
  - `custoHoraCarregado(base, taxaPct): number`
  - `plIncidencia({ tempoMinutos, custoHoraCarregado, deslocacaoValor, custosMateriais, precoProprietario }): PL`
  - `plProjeto({ custos, orcamentoValor }): PL`
  - `resumoTecnicoDia(itens: { pl: PL; tempoMinutos: number | null }[], cfg: { horasDiaPadrao: number; custoHoraCarregado: number }): ResumoDia`

- [x] **Step 1: Write the failing tests**

Append to `src/lib/custo.test.ts` (add the new symbols to the existing import line, then a new `describe`):

```ts
import { describe, it, expect } from "vitest";
import {
  maoDeObra,
  totalIncidencia,
  formatarTempo,
  custoHoraCarregado,
  plIncidencia,
  plProjeto,
  resumoTecnicoDia,
} from "@/lib/custo";
```

```ts
describe("rentabilidade", () => {
  it("custoHoraCarregado aplica encargos sobre o base", () => {
    expect(custoHoraCarregado(12, 23.75)).toBe(14.85);
    expect(custoHoraCarregado(12, 0)).toBe(12);
    expect(custoHoraCarregado(null, 23.75)).toBe(0);
    expect(custoHoraCarregado(10, null)).toBe(10);
  });

  it("plIncidencia: receita - (tempo + deslocação + materiais)", () => {
    const pl = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: 14.85,
      deslocacaoValor: 5,
      custosMateriais: 10,
      precoProprietario: 40,
    });
    expect(pl.custoTempo).toBe(14.85);
    expect(pl.custoDeslocacao).toBe(5);
    expect(pl.custoMateriais).toBe(10);
    expect(pl.custoTotal).toBe(29.85);
    expect(pl.receita).toBe(40);
    expect(pl.rentabilidade).toBe(10.15);
  });

  it("plIncidencia: sem técnico → custo de tempo 0; sem preço → receita 0", () => {
    const pl = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: null,
      deslocacaoValor: null,
      custosMateriais: null,
      precoProprietario: null,
    });
    expect(pl.custoTempo).toBe(0);
    expect(pl.custoTotal).toBe(0);
    expect(pl.receita).toBe(0);
    expect(pl.rentabilidade).toBe(0);
  });

  it("plProjeto: orçamento - custos", () => {
    const pl = plProjeto({ custos: 120, orcamentoValor: 300 });
    expect(pl.custoTotal).toBe(120);
    expect(pl.receita).toBe(300);
    expect(pl.rentabilidade).toBe(180);
    expect(plProjeto({ custos: 50, orcamentoValor: null }).rentabilidade).toBe(-50);
  });

  it("resumoTecnicoDia: agrega, calcula ocupação e break-even", () => {
    const a = plIncidencia({
      tempoMinutos: 120,
      custoHoraCarregado: 15,
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 50,
    });
    const b = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: 15,
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 20,
    });
    const r = resumoTecnicoDia(
      [
        { pl: a, tempoMinutos: 120 },
        { pl: b, tempoMinutos: 60 },
      ],
      { horasDiaPadrao: 8, custoHoraCarregado: 15 },
    );
    expect(r.nIntervencoes).toBe(2);
    expect(r.receita).toBe(70);
    expect(r.custoTotal).toBe(45); // 30 + 15
    expect(r.resultado).toBe(25);
    expect(r.minutosProdutivos).toBe(180);
    expect(r.custoFixoDia).toBe(120); // 8 * 15
    expect(r.ocupacaoPct).toBe(38); // 3h / 8h
    expect(r.breakEvenPct).toBe(58); // 70 / 120
  });

  it("resumoTecnicoDia: guards com 0 horas e lista vazia", () => {
    const r = resumoTecnicoDia([], { horasDiaPadrao: 0, custoHoraCarregado: 0 });
    expect(r.nIntervencoes).toBe(0);
    expect(r.receita).toBe(0);
    expect(r.ocupacaoPct).toBe(0);
    expect(r.breakEvenPct).toBe(0);
    expect(r.custoFixoDia).toBe(0);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/custo.test.ts`
Expected: FAIL — `custoHoraCarregado is not a function` (and the other new symbols undefined).

- [x] **Step 3: Implement the functions in `src/lib/custo.ts`**

Append to `src/lib/custo.ts` (after the existing exports):

```ts
export interface PL {
  custoTempo: number;
  custoDeslocacao: number;
  custoMateriais: number;
  custoTotal: number;
  receita: number;
  rentabilidade: number;
}

export interface ResumoDia {
  receita: number;
  custoTotal: number;
  resultado: number;
  nIntervencoes: number;
  minutosProdutivos: number;
  custoFixoDia: number;
  ocupacaoPct: number;
  breakEvenPct: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Custo/hora com encargos (TSU/seguro) sobre o base. */
export function custoHoraCarregado(
  base: number | null | undefined,
  taxaPct: number | null | undefined,
): number {
  return round2((base ?? 0) * (1 + (taxaPct ?? 0) / 100));
}

/** P&L de uma incidência. Materiais = só linhas tipo 'material'. */
export function plIncidencia(p: {
  tempoMinutos: number | null | undefined;
  custoHoraCarregado: number | null | undefined;
  deslocacaoValor: number | null | undefined;
  custosMateriais: number | null | undefined;
  precoProprietario: number | null | undefined;
}): PL {
  const custoTempo = maoDeObra(p.tempoMinutos, p.custoHoraCarregado) ?? 0;
  const custoDeslocacao = p.deslocacaoValor ?? 0;
  const custoMateriais = round2(p.custosMateriais ?? 0);
  const custoTotal = round2(custoTempo + custoDeslocacao + custoMateriais);
  const receita = p.precoProprietario ?? 0;
  return {
    custoTempo,
    custoDeslocacao,
    custoMateriais,
    custoTotal,
    receita,
    rentabilidade: round2(receita - custoTotal),
  };
}

/** P&L de uma obra. Custo = Σ projeto_custos; receita = orçamento. */
export function plProjeto(p: {
  custos: number | null | undefined;
  orcamentoValor: number | null | undefined;
}): PL {
  const custoTotal = round2(p.custos ?? 0);
  const receita = p.orcamentoValor ?? 0;
  return {
    custoTempo: 0,
    custoDeslocacao: 0,
    custoMateriais: custoTotal,
    custoTotal,
    receita,
    rentabilidade: round2(receita - custoTotal),
  };
}

/** Agrega os P&L de um técnico num dia (ocupação, break-even).
 *  `custoHoraCarregado` é o do técnico do grupo. */
export function resumoTecnicoDia(
  itens: { pl: PL; tempoMinutos: number | null }[],
  cfg: { horasDiaPadrao: number; custoHoraCarregado: number },
): ResumoDia {
  const receita = round2(itens.reduce((a, it) => a + it.pl.receita, 0));
  const custoTotal = round2(itens.reduce((a, it) => a + it.pl.custoTotal, 0));
  const minutosProdutivos = itens.reduce(
    (a, it) => a + (it.tempoMinutos ?? 0),
    0,
  );
  const custoFixoDia = round2(cfg.horasDiaPadrao * cfg.custoHoraCarregado);
  return {
    receita,
    custoTotal,
    resultado: round2(receita - custoTotal),
    nIntervencoes: itens.length,
    minutosProdutivos,
    custoFixoDia,
    ocupacaoPct:
      cfg.horasDiaPadrao > 0
        ? Math.round((minutosProdutivos / 60 / cfg.horasDiaPadrao) * 100)
        : 0,
    breakEvenPct:
      custoFixoDia > 0 ? Math.round((receita / custoFixoDia) * 100) : 0,
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/custo.test.ts`
Expected: PASS (existing `custo` describe + new `rentabilidade` describe).

- [x] **Step 5: Commit**

```bash
git add src/lib/custo.ts src/lib/custo.test.ts
git commit -m "feat(custo): camada de calculo de rentabilidade (P&L) + testes"
```

---

## Task 3: Config data layer

**Files:**
- Create: `src/lib/data/config.ts`

**Interfaces:**
- Consumes: `Config` type (Task 1).
- Produces: `getConfig(): Promise<Config>` (defaults 23.75/8 if row missing); `updateConfig(patch: { taxa_encargos_pct?: number; horas_dia_padrao?: number }): Promise<void>`.

- [x] **Step 1: Write `src/lib/data/config.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Config } from "@/lib/types";

const DEFAULTS: Config = {
  id: 1,
  taxa_encargos_pct: 23.75,
  horas_dia_padrao: 8,
  moeda: "EUR",
  atualizado_em: new Date(0).toISOString(),
};

export async function getConfig(): Promise<Config> {
  const { data, error } = await supabaseAdmin()
    .from("config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data as Config) ?? DEFAULTS;
}

export async function updateConfig(patch: {
  taxa_encargos_pct?: number;
  horas_dia_padrao?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("config")
    .upsert({ id: 1, ...patch, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}
```

- [x] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/data/config.ts
git commit -m "feat(data): getConfig/updateConfig"
```

---

## Task 4: Rentabilidade data layer

**Files:**
- Create: `src/lib/data/rentabilidade.ts`

**Interfaces:**
- Consumes: `plIncidencia`, `plProjeto`, `resumoTecnicoDia`, `custoHoraCarregado`, `PL`, `ResumoDia` (Task 2); `getConfig` (Task 3).
- Produces:
  - `interface ItemPL { id; titulo; apartamento_codigo; tempoMinutos: number | null; pl: PL }`
  - `interface ResumoTecnico { tecnico: { id: string; nome: string; iniciais: string } | null; resumo: ResumoDia; itens: ItemPL[] }`
  - `resumoDia(dataISO: string): Promise<ResumoTecnico[]>`
  - `getPLIncidencia(id: string): Promise<PL | null>`
  - `getPLProjeto(id: string): Promise<PL | null>`
  - `interface LinhaNaoRentavel { kind: "inc" | "proj"; id: string; titulo: string; apartamento_codigo: string; rentabilidade: number }`
  - `listNaoRentaveis(): Promise<LinhaNaoRentavel[]>`

- [x] **Step 1: Write `src/lib/data/rentabilidade.ts`**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/data/config";
import {
  custoHoraCarregado,
  plIncidencia,
  plProjeto,
  resumoTecnicoDia,
  type PL,
  type ResumoDia,
} from "@/lib/custo";

type Db = ReturnType<typeof supabaseAdmin>;

const ESTADOS_CONCLUIDAS = ["resolvida", "fechada"] as const;

export interface ItemPL {
  id: string;
  titulo: string;
  apartamento_codigo: string;
  tempoMinutos: number | null;
  pl: PL;
}

export interface ResumoTecnico {
  tecnico: { id: string; nome: string; iniciais: string } | null;
  resumo: ResumoDia;
  itens: ItemPL[];
}

export interface LinhaNaoRentavel {
  kind: "inc" | "proj";
  id: string;
  titulo: string;
  apartamento_codigo: string;
  rentabilidade: number;
}

interface IncRow {
  id: string;
  titulo: string;
  tempo_minutos: number | null;
  deslocacao_valor: number | null;
  preco_proprietario: number | null;
  tecnico_id: string | null;
  apartamento: { codigo: string } | null;
  tecnico: { id: string; nome: string; iniciais: string; custo_hora: number } | null;
}

const SELECT_INC_PL = `
  id, titulo, tempo_minutos, deslocacao_valor, preco_proprietario, tecnico_id,
  apartamento:apartamentos ( codigo ),
  tecnico:tecnicos ( id, nome, iniciais, custo_hora )
`;

/** Σ (quantidade × valor_unitario) de linhas tipo 'material' por incidência. */
async function materiaisPorIncidencia(
  db: Db,
  ids: string[],
): Promise<Map<string, number>> {
  const soma = new Map<string, number>();
  if (ids.length === 0) return soma;
  const { data, error } = await db
    .from("incidencia_custos")
    .select("incidencia_id, quantidade, valor_unitario")
    .in("incidencia_id", ids)
    .eq("tipo", "material");
  if (error) throw error;
  for (const r of data ?? []) {
    const row = r as {
      incidencia_id: string;
      quantidade: number;
      valor_unitario: number;
    };
    soma.set(
      row.incidencia_id,
      (soma.get(row.incidencia_id) ?? 0) + row.quantidade * row.valor_unitario,
    );
  }
  return soma;
}

function itemDeIncidencia(
  row: IncRow,
  materiais: number,
  taxaEncargos: number,
): ItemPL {
  const pl = plIncidencia({
    tempoMinutos: row.tempo_minutos,
    custoHoraCarregado: row.tecnico
      ? custoHoraCarregado(row.tecnico.custo_hora, taxaEncargos)
      : null,
    deslocacaoValor: row.deslocacao_valor,
    custosMateriais: materiais,
    precoProprietario: row.preco_proprietario,
  });
  return {
    id: row.id,
    titulo: row.titulo,
    apartamento_codigo: row.apartamento?.codigo ?? "—",
    tempoMinutos: row.tempo_minutos,
    pl,
  };
}

/** Resumo por técnico das incidências concluídas num dado dia (data efetiva de resolução). */
export async function resumoDia(dataISO: string): Promise<ResumoTecnico[]> {
  const db = supabaseAdmin();
  const cfg = await getConfig();

  const inicio = new Date(dataISO + "T00:00:00");
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  const { data, error } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .in("estado", ESTADOS_CONCLUIDAS as unknown as string[])
    .gte("resolvida_em", inicio.toISOString())
    .lt("resolvida_em", fim.toISOString());
  if (error) throw error;

  const rows = (data ?? []) as unknown as IncRow[];
  const materiais = await materiaisPorIncidencia(
    db,
    rows.map((r) => r.id),
  );

  // Agrupar por técnico (chave null → bucket "sem técnico").
  const grupos = new Map<string, { tecnico: IncRow["tecnico"]; itens: ItemPL[] }>();
  for (const row of rows) {
    const chave = row.tecnico?.id ?? "__sem__";
    if (!grupos.has(chave)) grupos.set(chave, { tecnico: row.tecnico, itens: [] });
    grupos
      .get(chave)!
      .itens.push(itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct));
  }

  const resultado: ResumoTecnico[] = [];
  for (const { tecnico, itens } of grupos.values()) {
    const chc = tecnico
      ? custoHoraCarregado(tecnico.custo_hora, cfg.taxa_encargos_pct)
      : 0;
    resultado.push({
      tecnico: tecnico
        ? { id: tecnico.id, nome: tecnico.nome, iniciais: tecnico.iniciais }
        : null,
      resumo: resumoTecnicoDia(
        itens.map((it) => ({ pl: it.pl, tempoMinutos: it.tempoMinutos })),
        { horasDiaPadrao: cfg.horas_dia_padrao, custoHoraCarregado: chc },
      ),
      itens,
    });
  }
  // Técnicos primeiro (piores/melhores por resultado desc), "sem técnico" no fim.
  resultado.sort((a, b) => {
    if (!a.tecnico) return 1;
    if (!b.tecnico) return -1;
    return b.resumo.resultado - a.resumo.resultado;
  });
  return resultado;
}

export async function getPLIncidencia(id: string): Promise<PL | null> {
  const db = supabaseAdmin();
  const cfg = await getConfig();
  const { data, error } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as IncRow;
  const materiais = await materiaisPorIncidencia(db, [row.id]);
  return itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct).pl;
}

/** Σ (quantidade × valor_unitario) de todas as linhas de um projeto. */
async function somaCustosProjeto(db: Db, projetoId: string): Promise<number> {
  const { data, error } = await db
    .from("projeto_custos")
    .select("quantidade, valor_unitario")
    .eq("projeto_id", projetoId);
  if (error) throw error;
  return (data ?? []).reduce((a, r) => {
    const row = r as { quantidade: number; valor_unitario: number };
    return a + row.quantidade * row.valor_unitario;
  }, 0);
}

export async function getPLProjeto(id: string): Promise<PL | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("projetos")
    .select("id, orcamento_valor")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const proj = data as { id: string; orcamento_valor: number | null };
  const custos = await somaCustosProjeto(db, proj.id);
  return plProjeto({ custos, orcamentoValor: proj.orcamento_valor });
}

/** Incidências concluídas + projetos concluídos com rentabilidade < 0, piores primeiro. */
export async function listNaoRentaveis(): Promise<LinhaNaoRentavel[]> {
  const db = supabaseAdmin();
  const cfg = await getConfig();
  const linhas: LinhaNaoRentavel[] = [];

  // Incidências concluídas
  const { data: incs, error: incErr } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .in("estado", ESTADOS_CONCLUIDAS as unknown as string[]);
  if (incErr) throw incErr;
  const incRows = (incs ?? []) as unknown as IncRow[];
  const materiais = await materiaisPorIncidencia(db, incRows.map((r) => r.id));
  for (const row of incRows) {
    const item = itemDeIncidencia(row, materiais.get(row.id) ?? 0, cfg.taxa_encargos_pct);
    if (item.pl.rentabilidade < 0) {
      linhas.push({
        kind: "inc",
        id: row.id,
        titulo: row.titulo,
        apartamento_codigo: item.apartamento_codigo,
        rentabilidade: item.pl.rentabilidade,
      });
    }
  }

  // Projetos concluídos
  const { data: projs, error: projErr } = await db
    .from("projetos")
    .select("id, titulo, orcamento_valor, apartamento:apartamentos ( codigo )")
    .eq("fase", "concluido");
  if (projErr) throw projErr;
  for (const p of projs ?? []) {
    const proj = p as unknown as {
      id: string;
      titulo: string;
      orcamento_valor: number | null;
      apartamento: { codigo: string } | null;
    };
    const custos = await somaCustosProjeto(db, proj.id);
    const pl = plProjeto({ custos, orcamentoValor: proj.orcamento_valor });
    if (pl.rentabilidade < 0) {
      linhas.push({
        kind: "proj",
        id: proj.id,
        titulo: proj.titulo,
        apartamento_codigo: proj.apartamento?.codigo ?? "—",
        rentabilidade: pl.rentabilidade,
      });
    }
  }

  linhas.sort((a, b) => a.rentabilidade - b.rentabilidade); // pior (mais negativo) primeiro
  return linhas;
}
```

- [x] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/lib/data/rentabilidade.ts
git commit -m "feat(data): agregacao de rentabilidade (resumoDia, PL, nao rentaveis)"
```

---

## Task 5: Agenda — effective date for incidências

**Files:**
- Modify: `src/lib/data/agenda.ts:20-47`

**Interfaces:**
- Consumes: `agendada_em` column (Task 1).
- Produces: incidência events placed at `COALESCE(agendada_em, aberta_em::date)`; unscheduled stay on creation day.

- [ ] **Step 1: Replace the incidências block in `src/lib/data/agenda.ts`**

Replace the current incidências query + loop (lines ~20–47, the block starting at the `// ── Incidências:` comment and ending before the `// ── Recorrentes:` comment) with:

```ts
  // ── Incidências ativas: agendadas na janela + não-agendadas criadas na janela.
  //    Data efetiva = COALESCE(agendada_em, aberta_em::date). ──────────────────
  const pushInc = (row: {
    id: string;
    titulo: string;
    tecnico_id: string | null;
    aberta_em: string;
    agendada_em: string | null;
    apartamento: { codigo: string } | null;
  }) => {
    eventos.push({
      id: row.id,
      kind: "inc",
      apartamento_codigo: row.apartamento?.codigo ?? "—",
      titulo: row.titulo,
      tecnico_id: row.tecnico_id,
      data: row.agendada_em ?? toISODate(new Date(row.aberta_em)),
    });
  };

  const selectInc = `id, titulo, tecnico_id, aberta_em, agendada_em,
       apartamento:apartamentos ( codigo )`;

  // (1) Agendadas cuja agendada_em cai na semana.
  const { data: incAgendadas, error: incAgErr } = await db
    .from("incidencias")
    .select(selectInc)
    .not("estado", "in", "(resolvida,fechada)")
    .gte("agendada_em", inicioStr)
    .lt("agendada_em", fimStr);
  if (incAgErr) throw incAgErr;
  for (const i of incAgendadas ?? []) pushInc(i as never);

  // (2) Não-agendadas criadas na semana (comportamento legado).
  const { data: incCriadas, error: incCrErr } = await db
    .from("incidencias")
    .select(selectInc)
    .not("estado", "in", "(resolvida,fechada)")
    .is("agendada_em", null)
    .gte("aberta_em", inicio.toISOString())
    .lt("aberta_em", fimExclusivo.toISOString());
  if (incCrErr) throw incCrErr;
  for (const i of incCriadas ?? []) pushInc(i as never);
```

(`inicioStr`, `fimStr`, `inicio`, `fimExclusivo`, `toISODate`, and `eventos` are already declared earlier in the function.)

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Start dev server (`npm run dev`), open `/agenda`. An unscheduled active incidência still shows on its creation day. After Task 7, setting `agendada_em` moves it to the scheduled day.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/agenda.ts
git commit -m "feat(agenda): incidencias pela data efetiva (agendada_em ou criacao)"
```

---

## Task 6: Persist `preco_proprietario` + `agendada_em` in incidência actions

**Files:**
- Modify: `src/app/(app)/incidencias/actions.ts` (`atualizarIncidencia` ~87-116; `criarIncidencia` ~27-53)

**Interfaces:**
- Consumes: the two new columns (Task 1).
- Produces: `atualizarIncidencia` and `criarIncidencia` read `preco_proprietario` and `agendada_em` from the form.

- [ ] **Step 1: Add both fields to the `atualizarIncidencia` patch**

In `atualizarIncidencia`, after the `deslocacao_valor` line inside the `patch` object, add:

```ts
    deslocacao_valor: valorRaw === "" ? null : num(formData.get("deslocacao_valor")),
    preco_proprietario:
      str(formData.get("preco_proprietario")) === ""
        ? null
        : num(formData.get("preco_proprietario")),
    agendada_em: strOuNull(formData.get("agendada_em")),
```

- [ ] **Step 2: Accept `agendada_em` on create**

In `criarIncidencia`, add `agendada_em` to the `.insert({...})` object:

```ts
      tecnico_id: strOuNull(formData.get("tecnico_id")),
      agendada_em: strOuNull(formData.get("agendada_em")),
```

- [ ] **Step 3: Revalidate the agenda after an update**

Still in `atualizarIncidencia`, add a revalidate for the agenda alongside the existing ones:

```ts
  revalidatePath(`/incidencias/${id}`);
  revalidatePath("/incidencias");
  revalidatePath("/agenda");
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/incidencias/actions.ts
git commit -m "feat(incidencias): gravar preco_proprietario e agendada_em"
```

---

## Task 7: Incidência editor — "Agendada para" + "Preço ao proprietário"

**Files:**
- Modify: `src/app/(app)/incidencias/[id]/IncidenciaEditor.tsx`
- Modify: `src/app/(app)/incidencias/[id]/page.tsx` (pass the two new props)

**Interfaces:**
- Consumes: `atualizarIncidencia` (Task 6).
- Produces: editor persists `agendada_em` + `preco_proprietario` via the existing "Guardar".

- [ ] **Step 1: Add the two props to the component signature**

In `IncidenciaEditor.tsx`, add to the props destructuring and the props type:

```ts
  deslocacaoValor,
  agendadaEm,
  precoProprietario,
  notasResolucao,
```

```ts
  deslocacaoValor: number | null;
  agendadaEm: string | null;
  precoProprietario: number | null;
  notasResolucao: string | null;
```

- [ ] **Step 2: Seed the two fields into local state**

Extend the `useState` initial object `f`:

```ts
    valor: deslocacaoValor != null ? String(deslocacaoValor) : "",
    agendada: agendadaEm ?? "",
    preco: precoProprietario != null ? String(precoProprietario) : "",
```

- [ ] **Step 3: Add "Agendada para" next to Técnico (planning block)**

In the "O problema" grid, after the Técnico `<div>` (the `select` with "Por atribuir"), add a new grid cell:

```tsx
          <div>
            <label className="label">Agendada para</label>
            <input
              type="date"
              className="input"
              value={f.agendada}
              onChange={(e) => set({ agendada: e.target.value })}
            />
          </div>
```

- [ ] **Step 4: Add "Preço ao proprietário" next to Valor deslocação**

In the deslocação grid (the `grid-cols-2` block with "Valor deslocação (€)"), add a third field below it (or extend the grid). Add after the "Valor deslocação (€)" `<div>`:

```tsx
          <div>
            <label className="label">Preço ao proprietário (€)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={f.preco}
              onChange={(e) => set({ preco: e.target.value })}
              placeholder="receita cobrada"
            />
          </div>
```

- [ ] **Step 5: Send both in the FormData in `guardar()`**

After `fd.set("deslocacao_valor", f.valor);` add:

```ts
    fd.set("agendada_em", f.agendada);
    fd.set("preco_proprietario", f.preco);
```

- [ ] **Step 6: Pass the props from the detail page**

In `src/app/(app)/incidencias/[id]/page.tsx`, in the `<IncidenciaEditor ... />` element, add:

```tsx
          deslocacaoValor={inc.deslocacao_valor}
          agendadaEm={inc.agendada_em}
          precoProprietario={inc.preco_proprietario}
          notasResolucao={inc.notas_resolucao}
```

- [ ] **Step 7: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Manual verification**

`npm run dev` → open an incidência → set "Agendada para" to another day and a "Preço ao proprietário" → Guardar → confirm the values persist on reload and the incidência moves day on `/agenda`.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/incidencias/[id]/IncidenciaEditor.tsx" "src/app/(app)/incidencias/[id]/page.tsx"
git commit -m "feat(incidencias): campos Agendada para e Preco ao proprietario"
```

---

## Task 8: Reusable P&L breakdown card + incidência detail

**Files:**
- Create: `src/components/PLBreakdown.tsx`
- Modify: `src/app/(app)/incidencias/[id]/page.tsx`

**Interfaces:**
- Consumes: `PL` (Task 2); `getPLIncidencia` (Task 4); `formatEuro`.
- Produces: `PLBreakdown({ pl, semPreco }: { pl: PL; semPreco?: boolean })` React component.

- [ ] **Step 1: Write `src/components/PLBreakdown.tsx`**

```tsx
import { formatEuro } from "@/lib/format";
import type { PL } from "@/lib/custo";

export function PLBreakdown({ pl, semPreco }: { pl: PL; semPreco?: boolean }) {
  const positivo = pl.rentabilidade >= 0;
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Rentabilidade</h3>
      <dl className="space-y-1.5 text-sm">
        <Linha rotulo="Receita" valor={pl.receita} />
        {semPreco ? (
          <p className="text-xs text-amber-600">Preço por definir.</p>
        ) : null}
        <Linha rotulo="− Mão de obra" valor={-pl.custoTempo} />
        <Linha rotulo="− Deslocação" valor={-pl.custoDeslocacao} />
        <Linha rotulo="− Materiais" valor={-pl.custoMateriais} />
        <div className="my-2 border-t border-slate-100" />
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-slate-800">Resultado</dt>
          <dd
            className={`text-lg font-bold ${positivo ? "text-emerald-600" : "text-red-600"}`}
          >
            {formatEuro(pl.rentabilidade)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <dt>{rotulo}</dt>
      <dd className="font-mono">{formatEuro(valor)}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Render the card in the incidência detail page**

In `src/app/(app)/incidencias/[id]/page.tsx`:

Add imports near the top:

```ts
import { PLBreakdown } from "@/components/PLBreakdown";
import { getPLIncidencia } from "@/lib/data/rentabilidade";
```

Add `getPLIncidencia(inc.id)` to the existing `Promise.all` and destructure it:

```ts
  const [custos, fotos, apartamentos, tecnicos, pl] = await Promise.all([
    listCustos(inc.id),
    listFotosIncidencia(inc.id),
    listApartamentosSelect(),
    listTecnicos(),
    getPLIncidencia(inc.id),
  ]);
```

Insert the card in the layout, right before the `<RegistoEmpresa ... />` element (section 5):

```tsx
        {pl ? (
          <PLBreakdown pl={pl} semPreco={inc.preco_proprietario == null} />
        ) : null}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → open an incidência with técnico + tempo + preço → the "Rentabilidade" card shows receita − custos = resultado (green/red). With no preço it shows "Preço por definir".

- [ ] **Step 5: Commit**

```bash
git add src/components/PLBreakdown.tsx "src/app/(app)/incidencias/[id]/page.tsx"
git commit -m "feat(incidencias): cartao de rentabilidade no detalhe"
```

---

## Task 9: Projeto detail — P&L card

**Files:**
- Modify: `src/app/(app)/projetos/[id]/page.tsx`

**Interfaces:**
- Consumes: `PLBreakdown` (Task 8); `getPLProjeto` (Task 4).

- [ ] **Step 1: Add imports**

In `src/app/(app)/projetos/[id]/page.tsx`:

```ts
import { PLBreakdown } from "@/components/PLBreakdown";
import { getPLProjeto } from "@/lib/data/rentabilidade";
```

- [ ] **Step 2: Fetch the P&L**

Add `getPLProjeto(params.id)` to the existing `Promise.all` and destructure it:

```ts
  const [custos, fotos, apartamentos, tecnicos, orcamentoUrl, pl] =
    await Promise.all([
      listCustosProjeto(proj.id),
      listFotosProjeto(proj.id),
      listApartamentosSelect(),
      listTecnicos(true),
      signedUrl(proj.orcamento_ficheiro),
      getPLProjeto(proj.id),
    ]);
```

- [ ] **Step 3: Render the card**

In the right-hand column (`<div className="space-y-6">` that holds `FaseControls` + Orçamento), add right after `<FaseControls ... />`:

```tsx
          {pl ? <PLBreakdown pl={pl} semPreco={proj.orcamento_valor == null} /> : null}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification**

`npm run dev` → open a projeto with an `orcamento_valor` and some custos → "Rentabilidade" card shows orçamento − custos = resultado.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/projetos/[id]/page.tsx"
git commit -m "feat(projetos): cartao de rentabilidade no detalhe"
```

---

## Task 10: Sidebar nav + daily dashboard

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/app/(app)/rentabilidade/SeletorData.tsx`
- Create: `src/app/(app)/rentabilidade/CartaoTecnico.tsx`
- Create: `src/app/(app)/rentabilidade/page.tsx`

**Interfaces:**
- Consumes: `resumoDia`, `listNaoRentaveis`, `ResumoTecnico`, `LinhaNaoRentavel` (Task 4); `formatEuro`, `toISODate`.
- Produces: `/rentabilidade` route with date selector, per-técnico cards, unprofitable panel.

- [ ] **Step 1: Add the nav entry in `src/components/Sidebar.tsx`**

In the `LINKS` array, add after the `projetos` entry:

```ts
  { href: "/rentabilidade", label: "Rentabilidade", icon: "€" },
```

- [ ] **Step 2: Write the client date selector `SeletorData.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";

export function SeletorData({ data }: { data: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      className="input w-auto"
      value={data}
      onChange={(e) => router.push(`/rentabilidade?data=${e.target.value}`)}
    />
  );
}
```

- [ ] **Step 3: Write the presentational `CartaoTecnico.tsx`**

```tsx
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
```

- [ ] **Step 4: Write the dashboard `page.tsx`**

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { resumoDia, listNaoRentaveis } from "@/lib/data/rentabilidade";
import { formatEuro, toISODate } from "@/lib/format";
import { SeletorData } from "./SeletorData";
import { CartaoTecnico } from "./CartaoTecnico";

export const dynamic = "force-dynamic";

export default async function RentabilidadePage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Rentabilidade" />
        <SetupNotice />
      </>
    );
  }

  const data = searchParams.data || toISODate(new Date());
  const [grupos, naoRentaveis] = await Promise.all([
    resumoDia(data),
    listNaoRentaveis(),
  ]);

  const algumNegativo = grupos.some((g) => g.resumo.resultado < 0);

  return (
    <>
      <PageHeader
        titulo="Rentabilidade"
        descricao="Ganhamos ou perdemos por intervenção — por técnico e por dia."
        acao={
          <div className="flex items-center gap-2">
            <SeletorData data={data} />
            <Link href="/rentabilidade/config" className="btn-secondary">
              Config
            </Link>
          </div>
        }
      />

      {algumNegativo ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          ⚠️ Há técnico(s) com resultado negativo neste dia.
        </div>
      ) : null}

      {grupos.length === 0 ? (
        <EmptyState
          titulo="Sem intervenções concluídas"
          descricao="Nenhuma incidência resolvida nesta data."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => (
            <CartaoTecnico key={g.tecnico?.id ?? "sem"} grupo={g} />
          ))}
        </div>
      )}

      {/* Não rentáveis */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Não rentáveis
        </h2>
        {naoRentaveis.length === 0 ? (
          <EmptyState
            titulo="Tudo positivo"
            descricao="Nenhuma intervenção ou obra concluída com prejuízo."
          />
        ) : (
          <div className="space-y-2">
            {naoRentaveis.map((l) => (
              <Link
                key={`${l.kind}-${l.id}`}
                href={l.kind === "inc" ? `/incidencias/${l.id}` : `/projetos/${l.id}`}
                className="card flex items-center justify-between gap-2 p-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {l.titulo}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {l.apartamento_codigo} · {l.kind === "inc" ? "Incidência" : "Obra"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-red-600">
                  {formatEuro(l.rentabilidade)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Manual verification**

`npm run dev` → click "Rentabilidade" in the sidebar → pick a date with resolved incidências → per-técnico cards render with resultado/ocupação/break-even; the "Não rentáveis" list shows negative jobs worst-first.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx "src/app/(app)/rentabilidade/SeletorData.tsx" "src/app/(app)/rentabilidade/CartaoTecnico.tsx" "src/app/(app)/rentabilidade/page.tsx"
git commit -m "feat(rentabilidade): nav + dashboard diario por tecnico + nao rentaveis"
```

---

## Task 11: Config page + `guardarConfig`

**Files:**
- Create: `src/app/(app)/rentabilidade/actions.ts`
- Create: `src/app/(app)/rentabilidade/config/page.tsx`

**Interfaces:**
- Consumes: `getConfig`, `updateConfig` (Task 3).
- Produces: `guardarConfig(formData: FormData)` server action; `/rentabilidade/config` route.

- [ ] **Step 1: Write `src/app/(app)/rentabilidade/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/lib/session";
import { updateConfig } from "@/lib/data/config";

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function guardarConfig(formData: FormData) {
  await exigirSessao();
  await updateConfig({
    taxa_encargos_pct: num(formData.get("taxa_encargos_pct")),
    horas_dia_padrao: num(formData.get("horas_dia_padrao")),
  });
  revalidatePath("/rentabilidade");
  revalidatePath("/rentabilidade/config");
  redirect("/rentabilidade");
}
```

- [ ] **Step 2: Write `src/app/(app)/rentabilidade/config/page.tsx`**

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/data/config";
import { guardarConfig } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Configuração" />
        <SetupNotice />
      </>
    );
  }

  const cfg = await getConfig();

  return (
    <>
      <PageHeader
        titulo="Configuração — Rentabilidade"
        descricao="Encargos e dia de trabalho padrão para o cálculo do break-even."
        acao={
          <Link href="/rentabilidade" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      <form action={guardarConfig} className="card max-w-md space-y-4 p-5">
        <div>
          <label className="label" htmlFor="taxa_encargos_pct">
            Taxa de encargos (%)
          </label>
          <input
            id="taxa_encargos_pct"
            name="taxa_encargos_pct"
            type="number"
            step="0.01"
            className="input"
            defaultValue={cfg.taxa_encargos_pct}
          />
          <p className="mt-1 text-xs text-slate-400">
            TSU + seguro sobre o custo/hora base do técnico (ex.: 23,75).
          </p>
        </div>

        <div>
          <label className="label" htmlFor="horas_dia_padrao">
            Horas por dia (break-even)
          </label>
          <input
            id="horas_dia_padrao"
            name="horas_dia_padrao"
            type="number"
            step="0.5"
            className="input"
            defaultValue={cfg.horas_dia_padrao}
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → `/rentabilidade` → "Config" → change the encargos %, Guardar → redirected to `/rentabilidade`; open a técnico card / incidência P&L and confirm the loaded cost (custo de tempo) changed accordingly.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/rentabilidade/actions.ts" "src/app/(app)/rentabilidade/config/page.tsx"
git commit -m "feat(rentabilidade): pagina de configuracao (encargos, horas/dia)"
```

---

## Task 12 (optional): Schedule at creation + agenda marker

**Files:**
- Modify: `src/app/(app)/incidencias/nova/NovaIncidenciaForm.tsx`
- Modify: `src/app/(app)/agenda/AgendaView.tsx`

**Interfaces:**
- Consumes: `criarIncidencia` accepting `agendada_em` (Task 6); `EventoAgenda` (already carries `data`).

- [ ] **Step 1: Add an "Agendar para" field to the nova-incidência form**

In `NovaIncidenciaForm.tsx`, add a controlled state near the others:

```ts
  const [agendada, setAgendada] = useState("");
```

Add a field inside the `<form>` after the Técnico `<div>`:

```tsx
        <div>
          <label className="label" htmlFor="agendada_em">
            Agendar para (opcional)
          </label>
          <input
            id="agendada_em"
            name="agendada_em"
            type="date"
            className="input"
            value={agendada}
            onChange={(e) => setAgendada(e.target.value)}
          />
        </div>
```

(The `<form action={criarIncidencia}>` submits `agendada_em` automatically; Task 6 already reads it.)

- [ ] **Step 2: Mark scheduled incidências on the agenda chip**

This step needs to know whether an event was scheduled. Minimal approach: the agenda already places scheduled incidências on `agendada_em`. To visually flag, extend `EventoAgenda` with an optional `agendado?: boolean`.

In `src/lib/types.ts`, add to `EventoAgenda`:

```ts
  data: string; // YYYY-MM-DD
  agendado?: boolean;
```

In `src/lib/data/agenda.ts`, set `agendado` when pushing scheduled incidências. In the `pushInc` helper add a second arg:

```ts
  const pushInc = (row: { /* ...same fields... */ }, agendado: boolean) => {
    eventos.push({
      id: row.id,
      kind: "inc",
      apartamento_codigo: row.apartamento?.codigo ?? "—",
      titulo: row.titulo,
      tecnico_id: row.tecnico_id,
      data: row.agendada_em ?? toISODate(new Date(row.aberta_em)),
      agendado,
    });
  };
```

Then call `pushInc(i as never, true)` in loop (1) and `pushInc(i as never, false)` in loop (2).

In `AgendaView.tsx`, in `EventoChip`, prefix scheduled incidências with a marker:

```tsx
      <span className="font-semibold">{evento.apartamento_codigo}</span>{" "}
      <span className="opacity-80">
        {evento.agendado ? "✎ " : ""}
        {evento.titulo}
      </span>
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev` → create a new incidência with "Agendar para" set → it appears on the chosen day in `/agenda` with a `✎` marker; an unscheduled one has no marker on its creation day.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/incidencias/nova/NovaIncidenciaForm.tsx" "src/app/(app)/agenda/AgendaView.tsx" src/lib/types.ts src/lib/data/agenda.ts
git commit -m "feat(agenda): agendar na criacao + marcador de agendada"
```

---

## Final verification

- [ ] Run the full test suite: `npm test` → all pass (existing + new `rentabilidade` describe).
- [ ] Run `npm run typecheck` → clean.
- [ ] Run `npm run lint` → clean (or pre-existing warnings only).
- [ ] Manual smoke: resolve an incidência with técnico+tempo+preço today → it appears in `/rentabilidade` under that técnico with a positive/negative result; give it a materials cost that exceeds the price → it appears in "Não rentáveis". Schedule another incidência → it lands on the right agenda day.
