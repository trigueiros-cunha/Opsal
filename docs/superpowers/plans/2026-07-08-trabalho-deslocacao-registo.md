# Trabalho, Deslocação e Registo para a Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registar tempo de trabalho (valorizado pelo técnico), deslocação (modo + valor) por incidência, e gerar os 4 campos do formulário "Maintenance resolution" da empresa prontos a copiar.

**Architecture:** Colunas novas em `incidencias` (`tempo_minutos`, `deslocacao_modo`, `deslocacao_valor`); dois módulos puros testáveis (`custo.ts`, `registo.ts`); uma server action de gravação; e dois componentes cliente no detalhe (editor + painel de registo com botões de copiar).

**Tech Stack:** Next.js 14 · TypeScript · Supabase (service_role) · Vitest.

## Global Constraints

- Locale **PT-PT** em toda a UI/cópia.
- **Single-user**; escrita via `supabaseAdmin()` (server-only). Cada action começa com `await exigirSessao()`.
- **Mão de obra só com técnico:** sem técnico atribuído → regista tempo mas **sem €** (não há valor por defeito).
- **Custos sem IVA** (a tabela `incidencia_custos` = serviços/materiais/loiças; valores líquidos).
- **Modos de deslocação:** carro, uber, trotinete, carrinha, **outro** (com campo de texto livre).
- Módulos `custo.ts`/`registo.ts` são **puros** (sem `server-only`, sem node/xlsx) — usáveis no cliente e no servidor.
- Design system: classes `.card`, `.input`, `.label`, `.btn-primary`, `.btn-secondary`.

## File Structure

- Modify: `db/schema.sql` — 3 colunas em incidencias.
- Modify: `src/lib/types.ts` — campos novos + `custo_hora` no técnico do join.
- Modify: `src/lib/data/incidencias.ts` — select inclui `custo_hora`.
- Create: `src/lib/custo.ts` (+ `custo.test.ts`) — cálculos puros.
- Create: `src/lib/registo.ts` (+ `registo.test.ts`) — texto dos 4 campos.
- Modify: `src/app/(app)/incidencias/actions.ts` — `guardarTrabalho`.
- Create: `src/app/(app)/incidencias/[id]/TrabalhoEditor.tsx` — editor cliente.
- Create: `src/app/(app)/incidencias/[id]/RegistoEmpresa.tsx` — painel de copiar.
- Modify: `src/app/(app)/incidencias/[id]/page.tsx` — render dos 2 cartões.

---

### Task 1: Schema — colunas de trabalho/deslocação

**Files:**
- Modify: `db/schema.sql`

- [ ] **Step 1: Acrescentar ao `db/schema.sql`**

A seguir à linha `create index if not exists incidencias_import_ref_key ... ;` (fim do bloco de incidencias), acrescentar:
```sql

-- trabalho e deslocação (fecho de incidência / registo para a empresa)
alter table incidencias add column if not exists tempo_minutos int;
alter table incidencias add column if not exists deslocacao_modo text;
alter table incidencias add column if not exists deslocacao_valor numeric(10,2);
```

- [ ] **Step 2: Aplicar no Supabase (manual)**

No SQL Editor do Supabase, correr:
```sql
alter table incidencias add column if not exists tempo_minutos int;
alter table incidencias add column if not exists deslocacao_modo text;
alter table incidencias add column if not exists deslocacao_valor numeric(10,2);
```
Expected: "Success. No rows returned". Idempotente.

- [ ] **Step 3: Commit**
```bash
git add db/schema.sql
git commit -m "feat(db): colunas tempo_minutos, deslocacao_modo, deslocacao_valor"
```

---

### Task 2: Tipos e camada de dados

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/data/incidencias.ts`

**Interfaces:**
- Produces: `Incidencia` com `tempo_minutos`, `deslocacao_modo`, `deslocacao_valor`; `IncidenciaComRelacoes.tecnico` inclui `custo_hora`.

- [ ] **Step 1: Acrescentar campos a `Incidencia` (types.ts)**

Em `src/lib/types.ts`, na interface `Incidencia`, a seguir a `resolvida_em: string | null;` acrescentar:
```ts
  tempo_minutos: number | null;
  deslocacao_modo: string | null;
  deslocacao_valor: number | null;
```

- [ ] **Step 2: Incluir `custo_hora` no técnico do join (types.ts)**

Alterar, em `IncidenciaComRelacoes`:
```ts
  tecnico: Pick<Tecnico, "id" | "nome" | "iniciais"> | null;
```
para:
```ts
  tecnico: Pick<Tecnico, "id" | "nome" | "iniciais" | "custo_hora"> | null;
```

- [ ] **Step 3: Incluir `custo_hora` no select (data/incidencias.ts)**

Em `src/lib/data/incidencias.ts`, alterar `SELECT_COM_RELACOES`:
```ts
  tecnico:tecnicos ( id, nome, iniciais )
```
para:
```ts
  tecnico:tecnicos ( id, nome, iniciais, custo_hora )
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Commit**
```bash
git add src/lib/types.ts src/lib/data/incidencias.ts
git commit -m "feat(incidencias): tipos e select para trabalho/deslocacao"
```

---

### Task 3: `custo.ts` — cálculos puros

**Files:**
- Create: `src/lib/custo.ts`
- Test: `src/lib/custo.test.ts`

**Interfaces:**
- Produces:
  - `maoDeObra(tempoMinutos: number | null | undefined, custoHora: number | null | undefined): number | null`
  - `totalIncidencia(p: { custos: number; maoDeObra: number | null; deslocacaoValor: number | null | undefined }): number`
  - `formatarTempo(tempoMinutos: number | null | undefined): string`

- [ ] **Step 1: Escrever o teste (falha)**

`src/lib/custo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { maoDeObra, totalIncidencia, formatarTempo } from "@/lib/custo";

describe("custo", () => {
  it("maoDeObra = tempo/60 * custoHora; null sem técnico ou sem tempo", () => {
    expect(maoDeObra(90, 20)).toBe(30);
    expect(maoDeObra(90, null)).toBeNull();
    expect(maoDeObra(0, 20)).toBeNull();
    expect(maoDeObra(null, 20)).toBeNull();
    expect(maoDeObra(30, 20)).toBe(10);
  });

  it("totalIncidencia soma custos + mão de obra + deslocação", () => {
    expect(totalIncidencia({ custos: 10, maoDeObra: 30, deslocacaoValor: 5 })).toBe(45);
    expect(totalIncidencia({ custos: 10, maoDeObra: null, deslocacaoValor: null })).toBe(10);
  });

  it("formatarTempo", () => {
    expect(formatarTempo(90)).toBe("1h30");
    expect(formatarTempo(60)).toBe("1h");
    expect(formatarTempo(45)).toBe("45min");
    expect(formatarTempo(0)).toBe("");
    expect(formatarTempo(null)).toBe("");
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- custo`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `custo.ts`**
```ts
export function maoDeObra(
  tempoMinutos: number | null | undefined,
  custoHora: number | null | undefined,
): number | null {
  if (!tempoMinutos || tempoMinutos <= 0) return null;
  if (!custoHora || custoHora <= 0) return null;
  return Math.round((tempoMinutos / 60) * custoHora * 100) / 100;
}

export function totalIncidencia(p: {
  custos: number;
  maoDeObra: number | null;
  deslocacaoValor: number | null | undefined;
}): number {
  const total = p.custos + (p.maoDeObra ?? 0) + (p.deslocacaoValor ?? 0);
  return Math.round(total * 100) / 100;
}

export function formatarTempo(tempoMinutos: number | null | undefined): string {
  if (!tempoMinutos || tempoMinutos <= 0) return "";
  const h = Math.floor(tempoMinutos / 60);
  const m = tempoMinutos % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- custo`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/custo.ts src/lib/custo.test.ts
git commit -m "feat(custo): calculo de mao de obra, total e formatacao de tempo"
```

---

### Task 4: `registo.ts` — texto dos 4 campos

**Files:**
- Create: `src/lib/registo.ts`
- Test: `src/lib/registo.test.ts`

**Interfaces:**
- Consumes: `custo.ts`.
- Produces:
  - `RegistoInput` (ver abaixo), `Registo` (`{ resolucao; custos; outros; total; tudo }`)
  - `construirRegisto(input: RegistoInput): Registo`

- [ ] **Step 1: Escrever o teste (falha)**

`src/lib/registo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { construirRegisto } from "@/lib/registo";

const base = {
  notasResolucao: "Trocado o canhão da fechadura",
  tempoMinutos: 90,
  deslocacaoModo: "carrinha",
  deslocacaoValor: 20,
  custos: [{ descricao: "Canhão", quantidade: 1, valor_unitario: 15 }],
  tecnico: { nome: "Guilherme Cunha", iniciais: "GC", custo_hora: 20 },
};

describe("construirRegisto", () => {
  it("caso completo (com técnico)", () => {
    const r = construirRegisto(base);
    expect(r.resolucao).toBe("Trocado o canhão da fechadura");
    expect(r.custos).toContain("Canhão");
    expect(r.custos).toContain("15,00€");
    expect(r.outros).toContain("Deslocação em carrinha");
    expect(r.outros).toContain("GC dedicou 1h30 no local");
    // total = custos 15 + mão de obra 30 + deslocação 20 = 65
    expect(r.total).toBe("65.00");
    expect(r.tudo).toContain("Custo estimado: 65.00");
  });

  it("sem técnico: tempo sem valor e frase genérica", () => {
    const r = construirRegisto({ ...base, tecnico: null });
    expect(r.outros).toContain("Trabalho no local: 1h30");
    // total = custos 15 + 0 mão de obra + deslocação 20 = 35
    expect(r.total).toBe("35.00");
  });

  it("sem deslocação nem tempo: outros vazio", () => {
    const r = construirRegisto({
      ...base,
      tempoMinutos: null,
      deslocacaoModo: null,
      deslocacaoValor: null,
    });
    expect(r.outros).toBe("");
  });

  it("sem custos: lista vazia", () => {
    const r = construirRegisto({ ...base, custos: [] });
    expect(r.custos).toBe("");
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- registo`
Expected: FAIL.

- [ ] **Step 3: Implementar `registo.ts`**
```ts
import { formatarTempo, maoDeObra, totalIncidencia } from "./custo";

export interface RegistoInput {
  notasResolucao: string | null;
  tempoMinutos: number | null;
  deslocacaoModo: string | null;
  deslocacaoValor: number | null;
  custos: { descricao: string; quantidade: number; valor_unitario: number }[];
  tecnico: { nome: string; iniciais: string; custo_hora: number } | null;
}

export interface Registo {
  resolucao: string;
  custos: string;
  outros: string;
  total: string;
  tudo: string;
}

function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}€`;
}

export function construirRegisto(input: RegistoInput): Registo {
  const resolucao = (input.notasResolucao ?? "").trim();

  // Campo 2 — faturas e custos (sem IVA).
  const custos = input.custos
    .map((c) => {
      const total = Math.round(c.quantidade * c.valor_unitario * 100) / 100;
      return `${c.descricao} — ${c.quantidade} x ${eur(c.valor_unitario)} = ${eur(total)}`;
    })
    .join("\n");

  // Campo 3 — outros custos sem fatura (deslocação + tempo), em frase.
  const partes: string[] = [];
  if (input.deslocacaoModo && input.deslocacaoModo.trim()) {
    const v = input.deslocacaoValor;
    partes.push(
      `Deslocação em ${input.deslocacaoModo.trim()}${v ? ` (${eur(v)})` : ""}.`,
    );
  }
  const tempo = formatarTempo(input.tempoMinutos);
  if (tempo) {
    partes.push(
      input.tecnico
        ? `${input.tecnico.iniciais} dedicou ${tempo} no local a resolver o problema.`
        : `Trabalho no local: ${tempo}.`,
    );
  }
  const outros = partes.join(" ");

  // Campo 4 — custo estimado (total).
  const somaCustos = input.custos.reduce(
    (a, c) => a + c.quantidade * c.valor_unitario,
    0,
  );
  const mo = maoDeObra(input.tempoMinutos, input.tecnico?.custo_hora ?? null);
  const total = totalIncidencia({
    custos: somaCustos,
    maoDeObra: mo,
    deslocacaoValor: input.deslocacaoValor,
  }).toFixed(2);

  const tudo = [
    `Como foi resolvido:\n${resolucao}`,
    `Faturas e custos (sem IVA):\n${custos}`,
    `Outros custos (sem fatura):\n${outros}`,
    `Custo estimado: ${total}`,
  ].join("\n\n");

  return { resolucao, custos, outros, total, tudo };
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- registo`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/registo.ts src/lib/registo.test.ts
git commit -m "feat(registo): construir os 4 campos do formulario da empresa"
```

---

### Task 5: Server action `guardarTrabalho`

**Files:**
- Modify: `src/app/(app)/incidencias/actions.ts`

**Interfaces:**
- Produces: `guardarTrabalho(formData: FormData): Promise<void>` (campos: `id`, `horas`, `minutos`, `deslocacao_modo`, `deslocacao_valor`, `notas_resolucao`).

- [ ] **Step 1: Acrescentar a action**

Em `src/app/(app)/incidencias/actions.ts`, a seguir à função `atualizarIncidencia` (antes de `// ── Mudar estado`), acrescentar:
```ts
// ── Trabalho & deslocação ─────────────────────────────────────────────────────
export async function guardarTrabalho(formData: FormData) {
  await exigirSessao();
  const id = str(formData.get("id"));
  if (!id) throw new Error("id em falta");

  const horas = num(formData.get("horas"));
  const minutos = num(formData.get("minutos"));
  const tempo = Math.round(horas * 60 + minutos);

  const valorRaw = str(formData.get("deslocacao_valor"));

  const { error } = await supabaseAdmin()
    .from("incidencias")
    .update({
      tempo_minutos: tempo > 0 ? tempo : null,
      deslocacao_modo: strOuNull(formData.get("deslocacao_modo")),
      deslocacao_valor: valorRaw === "" ? null : num(formData.get("deslocacao_valor")),
      notas_resolucao: strOuNull(formData.get("notas_resolucao")),
    })
    .eq("id", id);
  if (error) throw error;

  revalidatePath(`/incidencias/${id}`);
  revalidatePath("/incidencias");
}
```
(`str`, `strOuNull`, `num`, `supabaseAdmin`, `exigirSessao`, `revalidatePath` já estão importados no ficheiro.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/incidencias/actions.ts"
git commit -m "feat(incidencias): action guardarTrabalho"
```

---

### Task 6: `TrabalhoEditor` (cliente)

**Files:**
- Create: `src/app/(app)/incidencias/[id]/TrabalhoEditor.tsx`

**Interfaces:**
- Consumes: `guardarTrabalho`, `maoDeObra`, `formatarTempo`.

- [ ] **Step 1: Criar o componente**
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarTrabalho } from "../actions";
import { formatarTempo, maoDeObra } from "@/lib/custo";
import { formatEuro } from "@/lib/format";

const MODOS = ["carro", "uber", "trotinete", "carrinha", "outro"];

export function TrabalhoEditor({
  id,
  tempoMinutos,
  deslocacaoModo,
  deslocacaoValor,
  notasResolucao,
  custoHora,
}: {
  id: string;
  tempoMinutos: number | null;
  deslocacaoModo: string | null;
  deslocacaoValor: number | null;
  notasResolucao: string | null;
  custoHora: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const modoInicial = deslocacaoModo
    ? MODOS.includes(deslocacaoModo)
      ? deslocacaoModo
      : "outro"
    : "";
  const [horas, setHoras] = useState(String(Math.floor((tempoMinutos ?? 0) / 60) || ""));
  const [minutos, setMinutos] = useState(String((tempoMinutos ?? 0) % 60 || ""));
  const [modo, setModo] = useState(modoInicial);
  const [modoOutro, setModoOutro] = useState(
    modoInicial === "outro" ? (deslocacaoModo ?? "") : "",
  );
  const [valor, setValor] = useState(deslocacaoValor != null ? String(deslocacaoValor) : "");
  const [notas, setNotas] = useState(notasResolucao ?? "");

  const tempoMin = (Number(horas) || 0) * 60 + (Number(minutos) || 0);
  const mo = maoDeObra(tempoMin, custoHora);

  function guardar() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("horas", horas || "0");
    fd.set("minutos", minutos || "0");
    fd.set("deslocacao_modo", modo === "outro" ? modoOutro : modo);
    fd.set("deslocacao_valor", valor);
    fd.set("notas_resolucao", notas);
    startTransition(async () => {
      await guardarTrabalho(fd);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Trabalho &amp; deslocação
      </h3>

      <div className="space-y-4">
        <div>
          <label className="label">Tempo de trabalho</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              className="input w-20"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
            />
            <span className="text-sm text-slate-500">h</span>
            <input
              type="number"
              min="0"
              max="59"
              className="input w-20"
              value={minutos}
              onChange={(e) => setMinutos(e.target.value)}
            />
            <span className="text-sm text-slate-500">min</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {tempoMin > 0
              ? mo != null
                ? `${formatarTempo(tempoMin)} · mão de obra ${formatEuro(mo)}`
                : `${formatarTempo(tempoMin)} · sem técnico — sem valor`
              : "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Deslocação</label>
            <select
              className="input"
              value={modo}
              onChange={(e) => setModo(e.target.value)}
            >
              <option value="">—</option>
              {MODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {modo === "outro" ? (
              <input
                className="input mt-2"
                placeholder="Qual?"
                value={modoOutro}
                onChange={(e) => setModoOutro(e.target.value)}
              />
            ) : null}
          </div>
          <div>
            <label className="label">Valor deslocação (€)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">O que foi feito</label>
          <textarea
            className="input h-24 resize-y"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={guardar} disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros (assumindo `formatEuro` existe em `@/lib/format`; confirmar no ficheiro).

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/incidencias/[id]/TrabalhoEditor.tsx"
git commit -m "feat(incidencias): editor de trabalho e deslocacao"
```

---

### Task 7: `RegistoEmpresa` (cliente, copiar)

**Files:**
- Create: `src/app/(app)/incidencias/[id]/RegistoEmpresa.tsx`

**Interfaces:**
- Consumes: `Registo` de `@/lib/registo`.

- [ ] **Step 1: Criar o componente**
```tsx
"use client";

import { useState } from "react";
import type { Registo } from "@/lib/registo";

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Seccao({ titulo, texto }: { titulo: string; texto: string }) {
  const [estado, setEstado] = useState<"" | "ok" | "erro">("");
  const vazio = !texto.trim();
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">{titulo}</p>
        <button
          type="button"
          disabled={vazio}
          className="btn-secondary px-2 py-1 text-xs"
          onClick={async () => {
            const ok = await copiar(texto);
            setEstado(ok ? "ok" : "erro");
            setTimeout(() => setEstado(""), 1500);
          }}
        >
          {estado === "ok" ? "Copiado ✓" : estado === "erro" ? "Copia à mão" : "Copiar"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words text-xs text-slate-600">
        {vazio ? "—" : texto}
      </pre>
    </div>
  );
}

export function RegistoEmpresa({ registo }: { registo: Registo }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Registo para a empresa
        </h3>
        <button
          type="button"
          className="btn-primary px-2 py-1 text-xs"
          onClick={() => copiar(registo.tudo)}
        >
          Copiar tudo
        </button>
      </div>
      <div className="space-y-2">
        <Seccao titulo="Como foi resolvido" texto={registo.resolucao} />
        <Seccao titulo="Faturas e custos (sem IVA)" texto={registo.custos} />
        <Seccao titulo="Outros custos (sem fatura)" texto={registo.outros} />
        <Seccao titulo="Custo estimado" texto={registo.total} />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Bate certo com os 4 campos do "Maintenance resolution". Valores sem IVA.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/incidencias/[id]/RegistoEmpresa.tsx"
git commit -m "feat(incidencias): painel Registo para a empresa (copiar)"
```

---

### Task 8: Ligar na página de detalhe + verificação

**Files:**
- Modify: `src/app/(app)/incidencias/[id]/page.tsx`

- [ ] **Step 1: Imports**

Em `src/app/(app)/incidencias/[id]/page.tsx`, a seguir a `import { ApagarIncidencia } from "./ApagarIncidencia";`, acrescentar:
```tsx
import { TrabalhoEditor } from "./TrabalhoEditor";
import { RegistoEmpresa } from "./RegistoEmpresa";
import { construirRegisto } from "@/lib/registo";
```

- [ ] **Step 2: Construir o registo (server) antes do `return`**

A seguir à linha `if (!inc) notFound();` e ao bloco `const [custos, fotos, ...] = await Promise.all([...]);`, acrescentar:
```tsx
  const registo = construirRegisto({
    notasResolucao: inc.notas_resolucao,
    tempoMinutos: inc.tempo_minutos,
    deslocacaoModo: inc.deslocacao_modo,
    deslocacaoValor: inc.deslocacao_valor,
    custos: custos.map((c) => ({
      descricao: c.descricao,
      quantidade: c.quantidade,
      valor_unitario: c.valor_unitario,
    })),
    tecnico: inc.tecnico
      ? {
          nome: inc.tecnico.nome,
          iniciais: inc.tecnico.iniciais,
          custo_hora: inc.tecnico.custo_hora,
        }
      : null,
  });
```

- [ ] **Step 3: Renderizar os 2 cartões**

Na coluna direita (o `<div className="space-y-6">` que contém `EstadoControls`), a seguir ao `<EstadoControls ... />`, acrescentar:
```tsx
          <TrabalhoEditor
            id={inc.id}
            tempoMinutos={inc.tempo_minutos}
            deslocacaoModo={inc.deslocacao_modo}
            deslocacaoValor={inc.deslocacao_valor}
            notasResolucao={inc.notas_resolucao}
            custoHora={inc.tecnico?.custo_hora ?? null}
          />
          <RegistoEmpresa registo={registo} />
```

- [ ] **Step 4: Typecheck + testes + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: sem erros; testes passam; `/incidencias/[id]` compila.

- [ ] **Step 5: Verificação manual E2E (com deploy + SQL da Task 1 aplicado)**
1. Abrir uma incidência com técnico atribuído.
2. Meter 1h30 → aparece "mão de obra 30,00 €" (com técnico a 20 €/h).
3. Escolher deslocação "outro" → escrever "barco" + valor; escrever "o que foi feito"; Guardar.
4. Recarregar não é preciso — deve refletir; confirmar que o cartão "Registo para a empresa" mostra as 4 secções corretas e "Custo estimado" = soma.
5. Copiar cada secção e colar no formulário da empresa.
6. Numa incidência **sem técnico**: o tempo grava mas mão de obra fica "sem valor"; o registo usa "Trabalho no local: 1h30".

- [ ] **Step 6: Commit**
```bash
git add "src/app/(app)/incidencias/[id]/page.tsx"
git commit -m "feat(incidencias): mostrar Trabalho/deslocacao e Registo no detalhe"
```

---

## Self-Review

- **Spec coverage:** tempo→€ (T3/T6), deslocação modo+valor (T1/T6), "o que foi feito" (T6), registo 4 campos (T4/T7), schema (T1), tipos/select custo_hora (T2), sem técnico→sem valor (T3 maoDeObra→null), custos sem IVA (rótulo T7). ✓
- **Placeholder scan:** sem TBD/TODO; todos os passos têm código real. ✓
- **Type consistency:** `RegistoInput`/`Registo` definidos em T4 e usados em T7/T8; `construirRegisto`, `maoDeObra`, `formatarTempo`, `guardarTrabalho` consistentes entre tarefas; `inc.tecnico.custo_hora` disponível após T2. ✓
- **Dependência a confirmar em T6:** `formatEuro` existe em `src/lib/format.ts` (já usado noutras páginas) — usar; se a assinatura diferir, formatar com `toFixed(2)`.
