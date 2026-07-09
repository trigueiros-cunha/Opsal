# Rentabilidade do dia (custo do técnico = dia completo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework profitability so the técnico's cost is the full paid day (counted once per técnico/day), each incidência shows only its *contribution* (`price − travel − materials`), and the profit/loss verdict lives at the day level.

**Architecture:** A cohesive in-place refactor of the pure calc layer (`custo.ts`), the aggregation data layer (`rentabilidade.ts`), and the two UI cards. Because the calc signature, the data-layer public API, and the UI fields all change together, this is ONE atomic task — splitting it would leave a commit that doesn't type-check. TDD covers the pure calc; typecheck + the full suite + a manual pass gate the whole change. No schema change.

**Tech Stack:** Next.js 14 (App Router, Server Components), TypeScript, Supabase (server-only), TailwindCSS, Vitest.

## Global Constraints

- **Language/copy:** all UI copy in **PT-PT**.
- **Money:** every euro value **rounded to 2 decimals** (`Math.round(x*100)/100`, already the `round2` helper in `custo.ts`).
- **Técnico cost = full day, once:** `custo_dia = horas_dia_padrao × custo_hora_carregado`, counted **once per técnico per day** (not the sum of logged task minutes).
- **Per-incidência = contribution only:** `contribuição = preço_proprietario − deslocação − materiais`; materials = only `incidencia_custos` with `tipo='material'`. **No labor at the incidência level.**
- **Day verdict:** `resultado = Σ contribuição − custo_dia`; `break-even% = Σ contribuição / custo_dia × 100`.
- **Não rentáveis:** incidências with `contribuição < 0` + projetos `concluido` with `rentabilidade < 0`, worst first.
- **Do NOT touch** `registo.ts`/`construirRegisto`, `db/schema.sql`, `config`, or the projeto P&L (`plProjeto`, `getPLProjeto`, the projeto detail card). Keep `maoDeObra`, `totalIncidencia`, `formatarTempo`, `PL`, `plProjeto`, `custoHoraCarregado` in `custo.ts` (still used elsewhere).
- **No new dependencies.** Verification gate: `npm run typecheck` clean and `npm test` green.

---

## File Structure

**Modify:**
- `src/lib/custo.ts` (+ `src/lib/custo.test.ts`) — remove `plIncidencia`; add `Contribuicao` + `contribuicaoIncidencia`; replace `ResumoDia` + `resumoTecnicoDia`.
- `src/lib/data/rentabilidade.ts` — recompute on contribution basis; rename `getPLIncidencia`→`getContribIncidencia`, `ItemPL`→`ItemContrib`; `LinhaNaoRentavel.rentabilidade`→`valor`.
- `src/components/PLBreakdown.tsx` — add `ContribBreakdown` (incidência); keep `PLBreakdown` (projeto).
- `src/app/(app)/incidencias/[id]/page.tsx` — use `ContribBreakdown` + `getContribIncidencia`.
- `src/app/(app)/rentabilidade/CartaoTecnico.tsx` — new day breakdown lines.
- `src/app/(app)/rentabilidade/page.tsx` — `l.rentabilidade` → `l.valor`.

`src/app/(app)/projetos/[id]/page.tsx` stays unchanged (still uses `PLBreakdown` + `getPLProjeto`).

---

## Task 1: Rework rentabilidade to the daily-cost model

**Files:**
- Modify: `src/lib/custo.ts`, `src/lib/custo.test.ts`
- Modify: `src/lib/data/rentabilidade.ts`
- Modify: `src/components/PLBreakdown.tsx`
- Modify: `src/app/(app)/incidencias/[id]/page.tsx`
- Modify: `src/app/(app)/rentabilidade/CartaoTecnico.tsx`
- Modify: `src/app/(app)/rentabilidade/page.tsx`

**Interfaces produced:**
- `interface Contribuicao { receita: number; custoDeslocacao: number; custoMateriais: number; contribuicao: number }`
- `contribuicaoIncidencia({ deslocacaoValor, custosMateriais, precoProprietario }): Contribuicao`
- `interface ResumoDia { receita; custoDia; deslocacoes; materiais; contribuicao; resultado; nIntervencoes; minutosProdutivos; ocupacaoPct; breakEvenPct }` (all `number`)
- `resumoTecnicoDia(itens: { contrib: Contribuicao; tempoMinutos: number | null }[], cfg: { horasDiaPadrao: number; custoHoraCarregado: number }): ResumoDia`
- `getContribIncidencia(id: string): Promise<Contribuicao | null>`
- `ItemContrib`, `ResumoTecnico` (with `resumo: ResumoDia`, `itens: ItemContrib[]`), `LinhaNaoRentavel { kind; id; titulo; apartamento_codigo; valor: number }`
- `ContribBreakdown({ contrib: Contribuicao; semPreco?: boolean })`

### Calc layer (TDD)

- [ ] **Step 1: Rewrite the calc tests (RED)**

In `src/lib/custo.test.ts`, update the import to add the new symbols and drop `plIncidencia`:

```ts
import { describe, it, expect } from "vitest";
import {
  maoDeObra,
  totalIncidencia,
  formatarTempo,
  custoHoraCarregado,
  contribuicaoIncidencia,
  plProjeto,
  resumoTecnicoDia,
} from "@/lib/custo";
```

Replace the entire `describe("rentabilidade", …)` block with:

```ts
describe("rentabilidade", () => {
  it("custoHoraCarregado aplica encargos sobre o base", () => {
    expect(custoHoraCarregado(12, 23.75)).toBe(14.85);
    expect(custoHoraCarregado(12, 0)).toBe(12);
    expect(custoHoraCarregado(null, 23.75)).toBe(0);
    expect(custoHoraCarregado(10, null)).toBe(10);
  });

  it("contribuicaoIncidencia = receita − deslocação − materiais", () => {
    const c = contribuicaoIncidencia({
      deslocacaoValor: 5,
      custosMateriais: 10,
      precoProprietario: 40,
    });
    expect(c.receita).toBe(40);
    expect(c.custoDeslocacao).toBe(5);
    expect(c.custoMateriais).toBe(10);
    expect(c.contribuicao).toBe(25);
  });

  it("contribuicaoIncidencia: sem preço → receita 0; contribuição pode ficar negativa", () => {
    const c = contribuicaoIncidencia({
      deslocacaoValor: 8,
      custosMateriais: null,
      precoProprietario: null,
    });
    expect(c.receita).toBe(0);
    expect(c.contribuicao).toBe(-8); // o serviço não cobre a deslocação
  });

  it("plProjeto: orçamento − custos", () => {
    const pl = plProjeto({ custos: 120, orcamentoValor: 300 });
    expect(pl.custoTotal).toBe(120);
    expect(pl.receita).toBe(300);
    expect(pl.rentabilidade).toBe(180);
    expect(plProjeto({ custos: 50, orcamentoValor: null }).rentabilidade).toBe(-50);
  });

  it("resumoTecnicoDia: resultado = Σ contribuição − custo do dia", () => {
    const a = contribuicaoIncidencia({
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 50,
    });
    const b = contribuicaoIncidencia({
      deslocacaoValor: 5,
      custosMateriais: 0,
      precoProprietario: 20,
    });
    const r = resumoTecnicoDia(
      [
        { contrib: a, tempoMinutos: 120 },
        { contrib: b, tempoMinutos: 60 },
      ],
      { horasDiaPadrao: 8, custoHoraCarregado: 15 },
    );
    expect(r.nIntervencoes).toBe(2);
    expect(r.receita).toBe(70);
    expect(r.deslocacoes).toBe(5);
    expect(r.materiais).toBe(0);
    expect(r.contribuicao).toBe(65); // 50 + 15
    expect(r.custoDia).toBe(120); // 8 × 15
    expect(r.resultado).toBe(-55); // 65 − 120
    expect(r.minutosProdutivos).toBe(180);
    expect(r.ocupacaoPct).toBe(38); // 3h / 8h
    expect(r.breakEvenPct).toBe(54); // 65/120 → 54
  });

  it("resumoTecnicoDia: guards com 0 horas e lista vazia", () => {
    const r = resumoTecnicoDia([], { horasDiaPadrao: 0, custoHoraCarregado: 0 });
    expect(r.nIntervencoes).toBe(0);
    expect(r.receita).toBe(0);
    expect(r.contribuicao).toBe(0);
    expect(r.resultado).toBe(0);
    expect(r.ocupacaoPct).toBe(0);
    expect(r.breakEvenPct).toBe(0);
    expect(r.custoDia).toBe(0);
  });
});
```

- [ ] **Step 2: Run the calc tests — expect RED**

Run: `npx vitest run src/lib/custo.test.ts`
Expected: FAIL — `contribuicaoIncidencia is not a function` and `resumoTecnicoDia` returns the old shape (missing `contribuicao`/`custoDia`).

- [ ] **Step 3: Update `src/lib/custo.ts`**

**(a)** Replace the existing `ResumoDia` interface block:

```ts
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
```

with:

```ts
export interface Contribuicao {
  receita: number;
  custoDeslocacao: number;
  custoMateriais: number;
  contribuicao: number;
}

export interface ResumoDia {
  receita: number;
  custoDia: number;
  deslocacoes: number;
  materiais: number;
  contribuicao: number;
  resultado: number;
  nIntervencoes: number;
  minutosProdutivos: number;
  ocupacaoPct: number;
  breakEvenPct: number;
}
```

**(b)** Delete the entire `plIncidencia` function (the export `export function plIncidencia(p: {...}): PL { ... }` and its doc comment). Leave `plProjeto` and `custoHoraCarregado` untouched.

**(c)** Add the `contribuicaoIncidencia` function (put it right after `custoHoraCarregado`):

```ts
/** Contribuição de uma incidência = preço − deslocação − materiais (sem mão de obra). */
export function contribuicaoIncidencia(p: {
  deslocacaoValor: number | null | undefined;
  custosMateriais: number | null | undefined;
  precoProprietario: number | null | undefined;
}): Contribuicao {
  const receita = p.precoProprietario ?? 0;
  const custoDeslocacao = p.deslocacaoValor ?? 0;
  const custoMateriais = round2(p.custosMateriais ?? 0);
  return {
    receita,
    custoDeslocacao,
    custoMateriais,
    contribuicao: round2(receita - custoDeslocacao - custoMateriais),
  };
}
```

**(d)** Replace the entire `resumoTecnicoDia` function with:

```ts
/** Agrega o dia de um técnico: resultado = Σ contribuição − custo do dia (fixo). */
export function resumoTecnicoDia(
  itens: { contrib: Contribuicao; tempoMinutos: number | null }[],
  cfg: { horasDiaPadrao: number; custoHoraCarregado: number },
): ResumoDia {
  const receita = round2(itens.reduce((a, it) => a + it.contrib.receita, 0));
  const deslocacoes = round2(
    itens.reduce((a, it) => a + it.contrib.custoDeslocacao, 0),
  );
  const materiais = round2(
    itens.reduce((a, it) => a + it.contrib.custoMateriais, 0),
  );
  const contribuicao = round2(
    itens.reduce((a, it) => a + it.contrib.contribuicao, 0),
  );
  const minutosProdutivos = itens.reduce(
    (a, it) => a + (it.tempoMinutos ?? 0),
    0,
  );
  const custoDia = round2(cfg.horasDiaPadrao * cfg.custoHoraCarregado);
  return {
    receita,
    custoDia,
    deslocacoes,
    materiais,
    contribuicao,
    resultado: round2(contribuicao - custoDia),
    nIntervencoes: itens.length,
    minutosProdutivos,
    ocupacaoPct:
      cfg.horasDiaPadrao > 0
        ? Math.round((minutosProdutivos / 60 / cfg.horasDiaPadrao) * 100)
        : 0,
    breakEvenPct:
      custoDia > 0 ? Math.round((contribuicao / custoDia) * 100) : 0,
  };
}
```

- [ ] **Step 4: Run the calc tests — expect GREEN**

Run: `npx vitest run src/lib/custo.test.ts`
Expected: PASS. (`npm run typecheck` is still RED at this point — `rentabilidade.ts` and the UI reference the removed/changed symbols; the remaining steps fix that. Do not run the full typecheck yet.)

### Data layer

- [ ] **Step 5: Replace `src/lib/data/rentabilidade.ts` with:**

```ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/data/config";
import {
  contribuicaoIncidencia,
  custoHoraCarregado,
  plProjeto,
  resumoTecnicoDia,
  type Contribuicao,
  type PL,
  type ResumoDia,
} from "@/lib/custo";

type Db = ReturnType<typeof supabaseAdmin>;

const ESTADOS_CONCLUIDAS = ["resolvida", "fechada"] as const;

export interface ItemContrib {
  id: string;
  titulo: string;
  apartamento_codigo: string;
  tempoMinutos: number | null;
  contrib: Contribuicao;
}

export interface ResumoTecnico {
  tecnico: { id: string; nome: string; iniciais: string } | null;
  resumo: ResumoDia;
  itens: ItemContrib[];
}

export interface LinhaNaoRentavel {
  kind: "inc" | "proj";
  id: string;
  titulo: string;
  apartamento_codigo: string;
  valor: number;
}

interface IncRow {
  id: string;
  titulo: string;
  tempo_minutos: number | null;
  deslocacao_valor: number | null;
  preco_proprietario: number | null;
  tecnico_id: string | null;
  apartamento: { codigo: string } | null;
  tecnico: {
    id: string;
    nome: string;
    iniciais: string;
    custo_hora: number;
  } | null;
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

function itemDeIncidencia(row: IncRow, materiais: number): ItemContrib {
  return {
    id: row.id,
    titulo: row.titulo,
    apartamento_codigo: row.apartamento?.codigo ?? "—",
    tempoMinutos: row.tempo_minutos,
    contrib: contribuicaoIncidencia({
      deslocacaoValor: row.deslocacao_valor,
      custosMateriais: materiais,
      precoProprietario: row.preco_proprietario,
    }),
  };
}

/** Resumo por técnico das incidências concluídas num dado dia. */
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

  const grupos = new Map<
    string,
    { tecnico: IncRow["tecnico"]; itens: ItemContrib[] }
  >();
  for (const row of rows) {
    const chave = row.tecnico?.id ?? "__sem__";
    if (!grupos.has(chave)) grupos.set(chave, { tecnico: row.tecnico, itens: [] });
    grupos.get(chave)!.itens.push(itemDeIncidencia(row, materiais.get(row.id) ?? 0));
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
        itens.map((it) => ({ contrib: it.contrib, tempoMinutos: it.tempoMinutos })),
        { horasDiaPadrao: cfg.horas_dia_padrao, custoHoraCarregado: chc },
      ),
      itens,
    });
  }
  resultado.sort((a, b) => {
    if (!a.tecnico) return 1;
    if (!b.tecnico) return -1;
    return b.resumo.resultado - a.resumo.resultado;
  });
  return resultado;
}

export async function getContribIncidencia(
  id: string,
): Promise<Contribuicao | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as IncRow;
  const materiais = await materiaisPorIncidencia(db, [row.id]);
  return itemDeIncidencia(row, materiais.get(row.id) ?? 0).contrib;
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

/** Incidências com contribuição < 0 + projetos concluídos com rentabilidade < 0. */
export async function listNaoRentaveis(): Promise<LinhaNaoRentavel[]> {
  const db = supabaseAdmin();
  const linhas: LinhaNaoRentavel[] = [];

  const { data: incs, error: incErr } = await db
    .from("incidencias")
    .select(SELECT_INC_PL)
    .in("estado", ESTADOS_CONCLUIDAS as unknown as string[]);
  if (incErr) throw incErr;
  const incRows = (incs ?? []) as unknown as IncRow[];
  const materiais = await materiaisPorIncidencia(db, incRows.map((r) => r.id));
  for (const row of incRows) {
    const item = itemDeIncidencia(row, materiais.get(row.id) ?? 0);
    if (item.contrib.contribuicao < 0) {
      linhas.push({
        kind: "inc",
        id: row.id,
        titulo: row.titulo,
        apartamento_codigo: item.apartamento_codigo,
        valor: item.contrib.contribuicao,
      });
    }
  }

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
        valor: pl.rentabilidade,
      });
    }
  }

  linhas.sort((a, b) => a.valor - b.valor); // pior (mais negativo) primeiro
  return linhas;
}
```

### UI

- [ ] **Step 6: Add `ContribBreakdown` to `src/components/PLBreakdown.tsx`**

Change the type import at the top from:

```ts
import type { PL } from "@/lib/custo";
```

to:

```ts
import type { PL, Contribuicao } from "@/lib/custo";
```

Then add this exported component (after the existing `PLBreakdown` function, before the private `Linha` function — `ContribBreakdown` reuses the same `Linha`):

```tsx
export function ContribBreakdown({
  contrib,
  semPreco,
}: {
  contrib: Contribuicao;
  semPreco?: boolean;
}) {
  const positivo = contrib.contribuicao >= 0;
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Rentabilidade</h3>
      <dl className="space-y-1.5 text-sm">
        <Linha rotulo="Receita" valor={contrib.receita} />
        {semPreco ? (
          <p className="text-xs text-amber-600">Preço por definir.</p>
        ) : null}
        <Linha rotulo="− Deslocação" valor={-contrib.custoDeslocacao} />
        <Linha rotulo="− Materiais" valor={-contrib.custoMateriais} />
        <div className="my-2 border-t border-slate-100" />
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-slate-800">Contribuição</dt>
          <dd
            className={`text-lg font-bold ${positivo ? "text-emerald-600" : "text-red-600"}`}
          >
            {formatEuro(contrib.contribuicao)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400">
        A mão de obra do técnico é contada no dia — vê a página Rentabilidade.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Update `src/app/(app)/incidencias/[id]/page.tsx`**

Change the two imports:

```ts
import { PLBreakdown } from "@/components/PLBreakdown";
import { getPLIncidencia } from "@/lib/data/rentabilidade";
```

to:

```ts
import { ContribBreakdown } from "@/components/PLBreakdown";
import { getContribIncidencia } from "@/lib/data/rentabilidade";
```

In the `Promise.all`, change the last entry and its binding:

```ts
  const [custos, fotos, apartamentos, tecnicos, contrib] = await Promise.all([
    listCustos(inc.id),
    listFotosIncidencia(inc.id),
    listApartamentosSelect(),
    listTecnicos(),
    getContribIncidencia(inc.id),
  ]);
```

Replace the card render:

```tsx
        {pl ? (
          <PLBreakdown pl={pl} semPreco={inc.preco_proprietario == null} />
        ) : null}
```

with:

```tsx
        {contrib ? (
          <ContribBreakdown
            contrib={contrib}
            semPreco={inc.preco_proprietario == null}
          />
        ) : null}
```

- [ ] **Step 8: Replace `src/app/(app)/rentabilidade/CartaoTecnico.tsx` with:**

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

      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <dt>Receita</dt>
          <dd className="font-mono">{formatEuro(resumo.receita)}</dd>
        </div>
        {tecnico ? (
          <div className="flex items-center justify-between text-slate-600">
            <dt>− Custo do dia</dt>
            <dd className="font-mono">{formatEuro(resumo.custoDia)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-slate-600">
          <dt>− Deslocações</dt>
          <dd className="font-mono">{formatEuro(resumo.deslocacoes)}</dd>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <dt>− Materiais</dt>
          <dd className="font-mono">{formatEuro(resumo.materiais)}</dd>
        </div>
      </dl>

      {tecnico ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              Break-even ({resumo.breakEvenPct}% de {formatEuro(resumo.custoDia)})
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
            {resumo.nIntervencoes} interv. ·{" "}
            {formatarTempo(resumo.minutosProdutivos) || "0min"} ·{" "}
            {formatNumero(resumo.minutosProdutivos / 60)}h
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Sem técnico — sem custo de dia nem break-even.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Update `src/app/(app)/rentabilidade/page.tsx`**

In the "Não rentáveis" list, change the amount rendering from:

```tsx
                <span className="shrink-0 text-sm font-bold text-red-600">
                  {formatEuro(l.rentabilidade)}
                </span>
```

to:

```tsx
                <span className="shrink-0 text-sm font-bold text-red-600">
                  {formatEuro(l.valor)}
                </span>
```

(The `algumNegativo` check uses `g.resumo.resultado`, which still exists — no other change here.)

### Verify + commit

- [ ] **Step 10: Full verification**

Run: `npm run typecheck`
Expected: clean (no errors) — all consumers now use the new API.

Run: `npm test`
Expected: all pass (the updated `rentabilidade` describe + everything else).

- [ ] **Step 11: Manual check**

`npm run dev`:
- Open an incidência with a price, a deslocação value, and a material cost → the "Rentabilidade" card shows **Receita − Deslocação − Materiais = Contribuição** (no "Mão de obra" line), and turns red when the price doesn't cover deslocação+materiais.
- Open `/rentabilidade` on a date with resolved incidências → each técnico card shows **Receita − Custo do dia − Deslocações − Materiais = Resultado**, with the break-even bar against the full daily cost. An incidência whose price doesn't cover its deslocação appears under "Não rentáveis".

- [ ] **Step 12: Commit**

```bash
git add src/lib/custo.ts src/lib/custo.test.ts src/lib/data/rentabilidade.ts src/components/PLBreakdown.tsx "src/app/(app)/incidencias/[id]/page.tsx" "src/app/(app)/rentabilidade/CartaoTecnico.tsx" "src/app/(app)/rentabilidade/page.tsx"
git commit -m "feat(rentabilidade): custo do tecnico = dia completo; contribuicao por incidencia"
```

---

## Final verification

- [ ] `npm test` → all pass. `npm run typecheck` → clean.
- [ ] `git grep -n "plIncidencia\|getPLIncidencia\|custoFixoDia\|custoTotal" src/app src/components src/lib/data` returns nothing (no stale references to the removed API).
- [ ] Manual smoke per Step 11.
