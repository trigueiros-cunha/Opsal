# Import de Incidências a partir de Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página no site que importa incidências de um Excel (.xlsx/.csv), com pré-visualização, insert-only incremental (não duplica) e título/prioridade por IA com fallback determinístico.

**Architecture:** Módulos puros e testáveis para parsing/mapeamento/assinatura/heurísticas em `src/lib/import/`; server actions que orquestram (analisar → confirmar em lotes); um wizard cliente para a UI. A idempotência assenta numa coluna `incidencias.import_ref` (hash de CASA+DATA+PROBLEMA) com índice único; a inserção usa `upsert(onConflict: import_ref, ignoreDuplicates)`.

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Supabase (service_role) · SheetJS (`xlsx`) · Anthropic SDK · Vitest (novo).

## Global Constraints

- Locale **PT-PT** em toda a UI e cópias.
- **Single-user**, sem RLS por utilizador; todo o acesso a dados via `supabaseAdmin()` (service_role, server-only). Cada action começa com `await exigirSessao()`.
- **Insert-only:** o import nunca atualiza incidências existentes; só insere linhas novas.
- Modelo de extração: `claude-sonnet-4-6` (id usado em `src/lib/extrair.ts`). Sem `ANTHROPIC_API_KEY` a extração degrada para heurística determinística.
- Módulos importados por componentes cliente **não** podem depender de `node:crypto`, `xlsx`, `server-only` nem do SDK Anthropic. Só `src/lib/import/tipos.ts` é seguro para o cliente.
- Seguir o design system existente: classes `.card`, `.input`, `.label`, `.btn-primary`, `.btn-secondary`, `.badge`, `.th`, `.td` (ver `src/app/globals.css`).

## File Structure

- Create: `src/lib/import/tipos.ts` — tipos partilhados (cliente-safe).
- Create: `src/lib/import/chave.ts` — normalização + data DD/MM/YYYY→ISO + `calcularImportRef` (usa `node:crypto`).
- Create: `src/lib/import/heuristicas.ts` — título curto + prioridade por palavras-chave (puro).
- Create: `src/lib/import/mapearLinha.ts` — linha crua → `LinhaMapeada` (puro; recebe mapa de apartamentos).
- Create: `src/lib/import/parseXlsx.ts` — SheetJS: bytes → `LinhaCrua[]`.
- Create: `src/lib/import/extrairTitulo.ts` — IA (título/prioridade) + fallback heurístico.
- Create: `src/lib/import/*.test.ts` — testes Vitest dos módulos puros + parse.
- Modify: `src/lib/data/incidencias.ts` — `getImportRefsExistentes(refs)`.
- Create: `src/app/(app)/incidencias/importar/actions.ts` — `analisarImport`, `importarLote`.
- Create: `src/app/(app)/incidencias/importar/page.tsx` — página (server) com auth/setup.
- Create: `src/app/(app)/incidencias/importar/ImportWizard.tsx` — wizard cliente.
- Modify: `src/app/(app)/incidencias/page.tsx` — botão "Importar" no cabeçalho.
- Modify: `db/schema.sql` — coluna + índice `import_ref`.
- Create: `vitest.config.ts` — config Vitest com alias `@`.
- Modify: `package.json` — devDep `vitest`, dep `xlsx`, script `test`.

---

### Task 1: Setup de testes (Vitest) e dependência `xlsx`

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/import/smoke.test.ts` (temporário)

**Interfaces:**
- Produces: comando `npm test` funcional; alias `@` resolvido nos testes.

- [ ] **Step 1: Instalar dependências**

Run:
```bash
npm install xlsx && npm install -D vitest
```
Expected: instala sem erros; `xlsx` em `dependencies`, `vitest` em `devDependencies`.

- [ ] **Step 2: Adicionar script `test`**

Em `package.json`, dentro de `"scripts"`, adicionar:
```json
    "test": "vitest run"
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: { environment: "node" },
});
```

- [ ] **Step 4: Criar teste de fumo**

`src/lib/import/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("setup", () => {
  it("corre", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Correr e confirmar**

Run: `npm test`
Expected: 1 teste passa.

- [ ] **Step 6: Remover o teste de fumo e commit**

```bash
rm src/lib/import/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: setup Vitest e dependencia xlsx para import"
```

---

### Task 2: `chave.ts` — normalização, data e assinatura

**Files:**
- Create: `src/lib/import/chave.ts`
- Test: `src/lib/import/chave.test.ts`

**Interfaces:**
- Produces:
  - `normalizarCasa(casa: string): string`
  - `normalizarProblema(problema: string): string`
  - `dataParaIso(data: string): string | null` (aceita `D/M/YYYY`, devolve `YYYY-MM-DD`)
  - `calcularImportRef(casa: string, dataIso: string, problema: string): string`

- [ ] **Step 1: Escrever o teste (falha)**

`src/lib/import/chave.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  normalizarCasa,
  normalizarProblema,
  dataParaIso,
  calcularImportRef,
} from "@/lib/import/chave";

describe("chave", () => {
  it("normaliza casa (trim + upper)", () => {
    expect(normalizarCasa("  almad2 ")).toBe("ALMAD2");
  });

  it("normaliza problema (trim + espaços colapsados)", () => {
    expect(normalizarProblema("  a   porta   partida ")).toBe("a porta partida");
  });

  it("converte data DD/MM/YYYY para ISO", () => {
    expect(dataParaIso("02/07/2026")).toBe("2026-07-02");
    expect(dataParaIso("2/7/2026")).toBe("2026-07-02");
  });

  it("rejeita datas inválidas", () => {
    expect(dataParaIso("31/02/2026")).toBeNull();
    expect(dataParaIso("2026-07-02")).toBeNull();
    expect(dataParaIso("")).toBeNull();
  });

  it("import_ref é estável e sensível ao conteúdo", () => {
    const a = calcularImportRef("ALMAD2", "2026-07-02", "porta partida");
    const b = calcularImportRef(" almad2 ", "2026-07-02", "porta   partida");
    const c = calcularImportRef("ALMAD2", "2026-07-02", "outra coisa");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- chave`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `chave.ts`**

```ts
import { createHash } from "node:crypto";

export function normalizarCasa(casa: string): string {
  return casa.trim().toUpperCase();
}

export function normalizarProblema(problema: string): string {
  return problema.trim().replace(/\s+/g, " ");
}

/** "DD/MM/YYYY" (ou "D/M/YYYY") → "YYYY-MM-DD"; null se inválida. */
export function dataParaIso(data: string): string | null {
  const m = data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null; // data impossível (ex.: 31/02)
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function calcularImportRef(
  casa: string,
  dataIso: string,
  problema: string,
): string {
  const base = `${normalizarCasa(casa)}|${dataIso}|${normalizarProblema(problema)}`;
  return createHash("sha256").update(base).digest("hex");
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- chave`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/chave.ts src/lib/import/chave.test.ts
git commit -m "feat(import): normalizacao, data e assinatura import_ref"
```

---

### Task 3: `heuristicas.ts` — título curto e prioridade

**Files:**
- Create: `src/lib/import/heuristicas.ts`
- Test: `src/lib/import/heuristicas.test.ts`

**Interfaces:**
- Consumes: `Prioridade` de `@/lib/types`.
- Produces:
  - `prioridadePorPalavrasChave(texto: string): Prioridade`
  - `tituloCurto(problema: string, maxPalavras?: number, maxChars?: number): string`

- [ ] **Step 1: Escrever o teste (falha)**

`src/lib/import/heuristicas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prioridadePorPalavrasChave, tituloCurto } from "@/lib/import/heuristicas";

describe("heuristicas", () => {
  it("deteta prioridade alta", () => {
    expect(prioridadePorPalavrasChave("há uma fuga de água na cozinha")).toBe("alta");
    expect(prioridadePorPalavrasChave("apartamento sem luz")).toBe("alta");
  });

  it("deteta prioridade baixa", () => {
    expect(prioridadePorPalavrasChave("trocar a lâmpada fundida")).toBe("baixa");
  });

  it("default média", () => {
    expect(prioridadePorPalavrasChave("a máquina da loiça não funciona")).toBe("media");
  });

  it("título curto limita palavras e nunca vem vazio", () => {
    expect(tituloCurto("a porta principal não fecha bem de todo mesmo", 4)).toBe(
      "a porta principal não",
    );
    expect(tituloCurto("   ")).toBe("Incidência");
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- heuristicas`
Expected: FAIL.

- [ ] **Step 3: Implementar `heuristicas.ts`**

```ts
import type { Prioridade } from "@/lib/types";

const ALTA = [
  /fuga/i, /inunda/i, /sem luz/i, /sem energia/i, /sem [aá]gua/i,
  /sem internet/i, /sem wifi/i, /g[aá]s/i, /fumo/i, /cheiro a queimado/i,
  /n[aã]o tranca/i, /seguran[cç]a/i,
];
const BAIXA = [/est[eé]tic/i, /l[aâ]mpada/i, /pilha/i, /quando puder/i, /sem pressa/i];

export function prioridadePorPalavrasChave(texto: string): Prioridade {
  if (ALTA.some((r) => r.test(texto))) return "alta";
  if (BAIXA.some((r) => r.test(texto))) return "baixa";
  return "media";
}

export function tituloCurto(
  problema: string,
  maxPalavras = 8,
  maxChars = 80,
): string {
  const limpo = problema.trim().replace(/\s+/g, " ");
  if (!limpo) return "Incidência";
  const palavras = limpo.split(" ").slice(0, maxPalavras).join(" ");
  const t = palavras.length > maxChars ? palavras.slice(0, maxChars).trim() : palavras;
  return t || "Incidência";
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- heuristicas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/heuristicas.ts src/lib/import/heuristicas.test.ts
git commit -m "feat(import): heuristicas de titulo e prioridade"
```

---

### Task 4: `tipos.ts` + `mapearLinha.ts`

**Files:**
- Create: `src/lib/import/tipos.ts`
- Create: `src/lib/import/mapearLinha.ts`
- Test: `src/lib/import/mapearLinha.test.ts`

**Interfaces:**
- Consumes: `chave.ts`, `heuristicas.ts`, tipos de `@/lib/types`.
- Produces:
  - Tipos: `LinhaCrua`, `MapaApartamentos`, `ApartamentoRef`, `CamposIncidencia`, `LinhaMapeada`, `ResultadoAnalise`.
  - `mapearLinha(crua: LinhaCrua, linha: number, apartamentos: MapaApartamentos): LinhaMapeada`

- [ ] **Step 1: Criar `tipos.ts`**

```ts
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
```

- [ ] **Step 2: Escrever o teste (falha)**

`src/lib/import/mapearLinha.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapearLinha } from "@/lib/import/mapearLinha";
import type { MapaApartamentos } from "@/lib/import/tipos";

const apts: MapaApartamentos = new Map([
  ["ALMAD2", { id: "id-almad2", regiao: "lisboa" }],
]);

function crua(over: Record<string, string> = {}): Record<string, string> {
  return {
    DATA: "02/07/2026",
    CASA: "ALMAD2",
    Cidade: "Lisboa",
    PROBLEMA: "a máquina da loiça não funciona",
    "RESP.": "HM",
    "Link para fotos/docs": "",
    "OBSERVAÇÕES FO": "",
    "OBSERVAÇÕES HM": "",
    "OBSERVAÇÕES HSK": "",
    RESOLVIDO: "Não",
    ...over,
  };
}

describe("mapearLinha", () => {
  it("mapeia uma linha válida (aberta)", () => {
    const r = mapearLinha(crua(), 2, apts);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.campos.apartamento_id).toBe("id-almad2");
    expect(r.campos.estado).toBe("aberta");
    expect(r.campos.resolvida_em).toBeNull();
    expect(r.campos.aberta_em).toBe("2026-07-02");
    expect(r.campos.descricao).toContain("a máquina da loiça");
    expect(r.campos.import_ref).toMatch(/^[0-9a-f]{64}$/);
  });

  it("RESOLVIDO=Sim → resolvida com resolvida_em", () => {
    const r = mapearLinha(crua({ RESOLVIDO: "Sim" }), 2, apts);
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.campos.estado).toBe("resolvida");
    expect(r.campos.resolvida_em).toBe("2026-07-02");
  });

  it("anexa observações e resp à descrição", () => {
    const r = mapearLinha(
      crua({ "OBSERVAÇÕES FO": "falar com hóspede", "RESP.": "HM" }),
      2,
      apts,
    );
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.campos.descricao).toContain("Obs. FO: falar com hóspede");
    expect(r.campos.descricao).toContain("Resp.: HM");
  });

  it("apartamento desconhecido → erro", () => {
    const r = mapearLinha(crua({ CASA: "ACMx" }), 5, apts);
    expect(r.status).toBe("erro");
    if (r.status !== "erro") return;
    expect(r.motivo).toContain("ACMx");
  });

  it("data inválida → erro; problema vazio → erro", () => {
    expect(mapearLinha(crua({ DATA: "xx" }), 2, apts).status).toBe("erro");
    expect(mapearLinha(crua({ PROBLEMA: "  " }), 2, apts).status).toBe("erro");
  });
});
```

- [ ] **Step 3: Correr e ver falhar**

Run: `npm test -- mapearLinha`
Expected: FAIL.

- [ ] **Step 4: Implementar `mapearLinha.ts`**

```ts
import type { LinhaCrua, LinhaMapeada, MapaApartamentos } from "./tipos";
import { calcularImportRef, dataParaIso, normalizarCasa } from "./chave";
import { prioridadePorPalavrasChave, tituloCurto } from "./heuristicas";

function normHeader(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.+$/, "");
}

function indexar(crua: LinhaCrua): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(crua)) out[normHeader(k)] = v ?? "";
  return out;
}

function composDescricao(cols: Record<string, string>): string {
  const partes: string[] = [];
  const problema = (cols["PROBLEMA"] ?? "").trim();
  if (problema) partes.push(problema);
  const add = (rot: string, val: string | undefined) => {
    const s = (val ?? "").trim();
    if (s) partes.push(`${rot}: ${s}`);
  };
  add("Obs. FO", cols["OBSERVACOES FO"]);
  add("Obs. HM", cols["OBSERVACOES HM"]);
  add("Obs. HSK", cols["OBSERVACOES HSK"]);
  add("Resp.", cols["RESP"]);
  add("Link", cols["LINK PARA FOTOS/DOCS"]);
  return partes.join("\n");
}

export function mapearLinha(
  crua: LinhaCrua,
  linha: number,
  apartamentos: MapaApartamentos,
): LinhaMapeada {
  const cols = indexar(crua);
  const casa = (cols["CASA"] ?? "").trim();
  const problema = (cols["PROBLEMA"] ?? "").trim();
  const dataBruta = (cols["DATA"] ?? "").trim();

  if (!problema) {
    return { status: "erro", linha, motivo: "PROBLEMA vazio", casa, problema };
  }
  const dataIso = dataParaIso(dataBruta);
  if (!dataIso) {
    return {
      status: "erro",
      linha,
      motivo: `Data inválida: "${dataBruta}"`,
      casa,
      problema,
    };
  }
  const apt = apartamentos.get(normalizarCasa(casa));
  if (!apt) {
    return {
      status: "erro",
      linha,
      motivo: `Apartamento desconhecido: "${casa}"`,
      casa,
      problema,
    };
  }

  const resolvido = (cols["RESOLVIDO"] ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const resolvida = resolvido === "SIM" || resolvido === "S";

  return {
    status: "ok",
    linha,
    campos: {
      apartamento_id: apt.id,
      apartamento_codigo: normalizarCasa(casa),
      titulo: tituloCurto(problema),
      descricao: composDescricao(cols),
      prioridade: prioridadePorPalavrasChave(problema),
      estado: resolvida ? "resolvida" : "aberta",
      origem: "hospede",
      aberta_em: dataIso,
      resolvida_em: resolvida ? dataIso : null,
      import_ref: calcularImportRef(casa, dataIso, problema),
      problema,
    },
  };
}
```

- [ ] **Step 5: Correr e ver passar**

Run: `npm test -- mapearLinha`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/tipos.ts src/lib/import/mapearLinha.ts src/lib/import/mapearLinha.test.ts
git commit -m "feat(import): tipos e mapeamento de linha do Excel"
```

---

### Task 5: `parseXlsx.ts` — leitura do ficheiro

**Files:**
- Create: `src/lib/import/parseXlsx.ts`
- Test: `src/lib/import/parseXlsx.test.ts`

**Interfaces:**
- Consumes: `xlsx`, `LinhaCrua`.
- Produces: `parseFicheiro(dados: Uint8Array): LinhaCrua[]`
- Nota: **sem** `import "server-only"` (para ser testável); por convenção só é importado por server actions.

- [ ] **Step 1: Escrever o teste (falha)**

`src/lib/import/parseXlsx.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFicheiro } from "@/lib/import/parseXlsx";

function ficheiro(linhas: string[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf as ArrayBuffer);
}

describe("parseFicheiro", () => {
  it("lê linhas por cabeçalho e faz trim", () => {
    const bytes = ficheiro([
      ["DATA", "CASA", "PROBLEMA", "RESOLVIDO"],
      ["02/07/2026", " ALMAD2 ", "porta partida", "Não"],
    ]);
    const linhas = parseFicheiro(bytes);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["CASA"]).toBe("ALMAD2");
    expect(linhas[0]["PROBLEMA"]).toBe("porta partida");
  });

  it("ficheiro sem linhas de dados → array vazio", () => {
    expect(parseFicheiro(ficheiro([["DATA", "CASA"]]))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- parseXlsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `parseXlsx.ts`**

```ts
import * as XLSX from "xlsx";
import type { LinhaCrua } from "./tipos";

/** Lê a primeira folha e devolve uma linha por registo, valores em texto. */
export function parseFicheiro(dados: Uint8Array): LinhaCrua[] {
  const wb = XLSX.read(dados, { type: "array" });
  const nome = wb.SheetNames[0];
  if (!nome) return [];
  const folha = wb.Sheets[nome];
  const cruas = XLSX.utils.sheet_to_json<Record<string, unknown>>(folha, {
    raw: false, // datas/números como texto tal como mostrados
    defval: "",
  });
  return cruas.map((l) => {
    const out: LinhaCrua = {};
    for (const [k, v] of Object.entries(l)) {
      out[k.trim()] = String(v ?? "").trim();
    }
    return out;
  });
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- parseXlsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/parseXlsx.ts src/lib/import/parseXlsx.test.ts
git commit -m "feat(import): leitura de .xlsx/.csv com SheetJS"
```

---

### Task 6: `extrairTitulo.ts` — IA com fallback

**Files:**
- Create: `src/lib/import/extrairTitulo.ts`
- Test: `src/lib/import/extrairTitulo.test.ts`

**Interfaces:**
- Consumes: Anthropic SDK, `heuristicas.ts`, `Prioridade`.
- Produces: `extrairTituloPrioridade(problema: string): Promise<{ titulo: string; prioridade: Prioridade }>`

- [ ] **Step 1: Escrever o teste do fallback (falha)**

O teste garante o comportamento determinístico sem chave (não faz rede).

`src/lib/import/extrairTitulo.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extrairTituloPrioridade } from "@/lib/import/extrairTitulo";

describe("extrairTituloPrioridade (fallback sem chave)", () => {
  const antes = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (antes !== undefined) process.env.ANTHROPIC_API_KEY = antes;
  });

  it("sem chave usa heurística", async () => {
    const r = await extrairTituloPrioridade("há uma fuga de água enorme na casa de banho");
    expect(r.prioridade).toBe("alta");
    expect(r.titulo.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Correr e ver falhar**

Run: `npm test -- extrairTitulo`
Expected: FAIL.

- [ ] **Step 3: Implementar `extrairTitulo.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Prioridade } from "@/lib/types";
import { prioridadePorPalavrasChave, tituloCurto } from "./heuristicas";

const MODELO = "claude-sonnet-4-6";
const PRIORIDADES: Prioridade[] = ["alta", "media", "baixa"];

const SYSTEM = `Extrais de uma mensagem de manutenção um JSON, sem texto à volta:
{"titulo":"resumo curto, máx 6 palavras","prioridade":"alta"|"media"|"baixa"}
Prioridade alta: fuga/água, inundação, sem luz, sem água, sem internet, gás,
fumo, porta que não tranca, segurança. Baixa: estética, lâmpada, pilha, "sem
pressa". Média: o resto.`;

export async function extrairTituloPrioridade(
  problema: string,
): Promise<{ titulo: string; prioridade: Prioridade }> {
  const fallback = {
    titulo: tituloCurto(problema),
    prioridade: prioridadePorPalavrasChave(problema),
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODELO,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: problema }],
    });
    const txt = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const inicio = txt.indexOf("{");
    const fim = txt.lastIndexOf("}");
    if (inicio < 0 || fim <= inicio) return fallback;
    const parsed = JSON.parse(txt.slice(inicio, fim + 1)) as {
      titulo?: string;
      prioridade?: string;
    };
    return {
      titulo: (parsed.titulo || fallback.titulo).slice(0, 120),
      prioridade: PRIORIDADES.includes(parsed.prioridade as Prioridade)
        ? (parsed.prioridade as Prioridade)
        : fallback.prioridade,
    };
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 4: Correr e ver passar**

Run: `npm test -- extrairTitulo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/extrairTitulo.ts src/lib/import/extrairTitulo.test.ts
git commit -m "feat(import): extracao IA de titulo/prioridade com fallback"
```

---

### Task 7: Schema — coluna e índice `import_ref`

**Files:**
- Modify: `db/schema.sql`

**Interfaces:**
- Produces: coluna `incidencias.import_ref text` + índice único `incidencias_import_ref_key`.

- [ ] **Step 1: Acrescentar ao `db/schema.sql`**

Depois do bloco `create table ... incidencias (...)` e respetivos índices (após a linha `create index if not exists incidencias_aberta_em_idx ...`), acrescentar:
```sql

-- import (idempotência do import de Excel): assinatura CASA+DATA+PROBLEMA.
-- Índice único NÃO parcial: em Postgres os NULL são distintos, por isso
-- incidências criadas à mão (import_ref NULL) não colidem, e o upsert
-- ON CONFLICT (import_ref) funciona.
alter table incidencias add column if not exists import_ref text;
create unique index if not exists incidencias_import_ref_key
  on incidencias (import_ref);
```

- [ ] **Step 2: Aplicar no Supabase (manual)**

No SQL Editor do Supabase, correr exatamente:
```sql
alter table incidencias add column if not exists import_ref text;
create unique index if not exists incidencias_import_ref_key
  on incidencias (import_ref);
```
Expected: "Success. No rows returned". (Idempotente — pode correr novamente.)

- [ ] **Step 3: Commit**

```bash
git add db/schema.sql
git commit -m "feat(db): coluna e indice unico import_ref em incidencias"
```

---

### Task 8: Data layer + server actions

**Files:**
- Modify: `src/lib/data/incidencias.ts`
- Create: `src/app/(app)/incidencias/importar/actions.ts`

**Interfaces:**
- Consumes: `parseFicheiro`, `mapearLinha`, `extrairTituloPrioridade`, tipos de import, `supabaseAdmin`, `exigirSessao`.
- Produces:
  - `getImportRefsExistentes(refs: string[]): Promise<Set<string>>`
  - `analisarImport(formData: FormData): Promise<ResultadoAnalise>`
  - `importarLote(campos: CamposIncidencia[]): Promise<{ inseridas: number }>`

- [ ] **Step 1: Adicionar `getImportRefsExistentes` a `src/lib/data/incidencias.ts`**

No fim do ficheiro (antes de `export type IncidenciaBase = Incidencia;`):
```ts
/** Dado um conjunto de import_refs, devolve os que já existem na base. */
export async function getImportRefsExistentes(
  refs: string[],
): Promise<Set<string>> {
  const existentes = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const bloco = refs.slice(i, i + CHUNK);
    if (bloco.length === 0) continue;
    const { data, error } = await supabaseAdmin()
      .from("incidencias")
      .select("import_ref")
      .in("import_ref", bloco);
    if (error) throw error;
    for (const r of data ?? []) {
      const v = (r as { import_ref: string | null }).import_ref;
      if (v) existentes.add(v);
    }
  }
  return existentes;
}
```

- [ ] **Step 2: Criar `actions.ts`**

`src/app/(app)/incidencias/importar/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirSessao } from "@/lib/session";
import { getImportRefsExistentes } from "@/lib/data/incidencias";
import { parseFicheiro } from "@/lib/import/parseXlsx";
import { mapearLinha } from "@/lib/import/mapearLinha";
import { extrairTituloPrioridade } from "@/lib/import/extrairTitulo";
import type {
  CamposIncidencia,
  MapaApartamentos,
  ResultadoAnalise,
} from "@/lib/import/tipos";
import type { Regiao } from "@/lib/types";

async function mapaApartamentos(): Promise<MapaApartamentos> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("id, codigo, regiao");
  if (error) throw error;
  const mapa: MapaApartamentos = new Map();
  for (const a of data ?? []) {
    const row = a as { id: string; codigo: string; regiao: Regiao };
    mapa.set(row.codigo.trim().toUpperCase(), { id: row.id, regiao: row.regiao });
  }
  return mapa;
}

export async function analisarImport(
  formData: FormData,
): Promise<ResultadoAnalise> {
  await exigirSessao();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Ficheiro em falta.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const linhas = parseFicheiro(bytes);
  const apartamentos = await mapaApartamentos();

  // linha i+2: 1 = cabeçalho no Excel.
  const mapeadas = linhas.map((l, i) => mapearLinha(l, i + 2, apartamentos));

  const ok = mapeadas.flatMap((m) => (m.status === "ok" ? [m] : []));
  const erros = mapeadas
    .flatMap((m) => (m.status === "erro" ? [m] : []))
    .map((m) => ({ linha: m.linha, motivo: m.motivo, casa: m.casa, problema: m.problema }));

  const existentes = await getImportRefsExistentes(ok.map((m) => m.campos.import_ref));

  const novas: CamposIncidencia[] = [];
  const vistos = new Set<string>();
  let existem = 0;
  for (const m of ok) {
    const ref = m.campos.import_ref;
    if (existentes.has(ref) || vistos.has(ref)) {
      existem += 1;
      continue;
    }
    vistos.add(ref);
    novas.push(m.campos);
  }

  return { novas, existem, erros, total: linhas.length };
}

async function comConcorrencia<T, R>(
  itens: T[],
  limite: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const res: R[] = new Array(itens.length);
  let i = 0;
  async function worker() {
    while (i < itens.length) {
      const idx = i++;
      res[idx] = await fn(itens[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, () => worker()),
  );
  return res;
}

export async function importarLote(
  campos: CamposIncidencia[],
): Promise<{ inseridas: number }> {
  await exigirSessao();
  if (campos.length === 0) return { inseridas: 0 };

  const comIa = await comConcorrencia(campos, 5, async (c) => {
    const { titulo, prioridade } = await extrairTituloPrioridade(c.problema);
    return { ...c, titulo, prioridade };
  });

  const rows = comIa.map((c) => ({
    apartamento_id: c.apartamento_id,
    titulo: c.titulo,
    descricao: c.descricao,
    prioridade: c.prioridade,
    estado: c.estado,
    origem: c.origem,
    aberta_em: c.aberta_em,
    resolvida_em: c.resolvida_em,
    import_ref: c.import_ref,
  }));

  const { data, error } = await supabaseAdmin()
    .from("incidencias")
    .upsert(rows, { onConflict: "import_ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  revalidatePath("/incidencias");
  revalidatePath("/");
  return { inseridas: data?.length ?? 0 };
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/incidencias.ts "src/app/(app)/incidencias/importar/actions.ts"
git commit -m "feat(import): data layer e server actions (analisar/importar em lote)"
```

---

### Task 9: UI — página e wizard

**Files:**
- Create: `src/app/(app)/incidencias/importar/page.tsx`
- Create: `src/app/(app)/incidencias/importar/ImportWizard.tsx`

**Interfaces:**
- Consumes: `analisarImport`, `importarLote`, tipos `ResultadoAnalise`/`CamposIncidencia`.

- [ ] **Step 1: Criar `page.tsx`**

```tsx
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportarPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Importar incidências" />
        <SetupNotice />
      </>
    );
  }
  return (
    <>
      <PageHeader
        titulo="Importar incidências"
        descricao="Carrega o Excel (.xlsx). Só as linhas novas entram; as que já existem são ignoradas."
      />
      <ImportWizard />
    </>
  );
}
```

- [ ] **Step 2: Criar `ImportWizard.tsx`**

```tsx
"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { analisarImport, importarLote } from "./actions";
import type { ResultadoAnalise } from "@/lib/import/tipos";

const LOTE = 15;
type Fase = "inicio" | "analisar" | "previsao" | "importar" | "fim";

export function ImportWizard() {
  const [fase, setFase] = useState<Fase>("inicio");
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<ResultadoAnalise | null>(null);
  const [pct, setPct] = useState(0);
  const [inseridas, setInseridas] = useState(0);

  async function onFicheiro(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    setFase("analisar");
    try {
      const fd = new FormData();
      fd.append("file", file);
      setAnalise(await analisarImport(fd));
      setFase("previsao");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha a ler o ficheiro.");
      setFase("inicio");
    }
  }

  async function confirmar() {
    if (!analise) return;
    setFase("importar");
    setPct(0);
    setInseridas(0);
    try {
      const novas = analise.novas;
      let feitas = 0;
      let total = 0;
      for (let i = 0; i < novas.length; i += LOTE) {
        const r = await importarLote(novas.slice(i, i + LOTE));
        total += r.inseridas;
        feitas += Math.min(LOTE, novas.length - i);
        setPct(Math.round((feitas / Math.max(novas.length, 1)) * 100));
        setInseridas(total);
      }
      setFase("fim");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha a importar.");
      setFase("previsao");
    }
  }

  return (
    <div className="space-y-5">
      {erro ? (
        <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      {(fase === "inicio" || fase === "analisar") && (
        <div className="card p-6">
          <label className="label">Ficheiro Excel (.xlsx ou .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFicheiro}
            disabled={fase === "analisar"}
            className="block text-sm"
          />
          {fase === "analisar" ? (
            <p className="mt-3 text-sm text-slate-500">A analisar o ficheiro…</p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Colunas esperadas: DATA, CASA, PROBLEMA, RESOLVIDO (e opcionais RESP.,
              OBSERVAÇÕES FO/HM/HSK, Link).
            </p>
          )}
        </div>
      )}

      {fase === "previsao" && analise && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">{analise.novas.length}</p>
              <p className="text-xs text-slate-500">Novas (vão entrar)</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">{analise.existem}</p>
              <p className="text-xs text-slate-500">Já existem (ignoradas)</p>
            </div>
            <div className="card p-4">
              <p className="text-2xl font-bold text-slate-900">{analise.erros.length}</p>
              <p className="text-xs text-slate-500">Com erro (não entram)</p>
            </div>
          </div>

          {analise.erros.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Linhas com erro — corrige no Excel e reimporta
              </div>
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th w-16">Linha</th>
                    <th className="th w-56">Motivo</th>
                    <th className="th">Problema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analise.erros.map((e, i) => (
                    <tr key={i}>
                      <td className="td">{e.linha}</td>
                      <td className="td text-red-600">{e.motivo}</td>
                      <td className="td text-slate-600">{e.problema}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analise.novas.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pré-visualização das novas (título afinado pela IA na importação)
              </div>
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th w-24">Casa</th>
                    <th className="th w-28">Data</th>
                    <th className="th w-24">Estado</th>
                    <th className="th">Título (provisório)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analise.novas.slice(0, 50).map((c) => (
                    <tr key={c.import_ref}>
                      <td className="td font-mono text-xs">{c.apartamento_codigo}</td>
                      <td className="td text-slate-600">{c.aberta_em}</td>
                      <td className="td">
                        <span className="badge border-slate-200 bg-slate-50 text-slate-600">
                          {c.estado}
                        </span>
                      </td>
                      <td className="td text-slate-700">{c.titulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analise.novas.length > 50 && (
                <p className="px-3 py-2 text-xs text-slate-500">
                  … e mais {analise.novas.length - 50}.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              className="btn-primary"
              disabled={analise.novas.length === 0}
              onClick={confirmar}
            >
              Importar {analise.novas.length} novas
            </button>
            <button className="btn-secondary" onClick={() => setFase("inicio")}>
              Escolher outro ficheiro
            </button>
          </div>
        </>
      )}

      {fase === "importar" && (
        <div className="card p-6">
          <p className="mb-3 text-sm text-slate-700">
            A importar… {inseridas} inseridas
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {fase === "fim" && (
        <div className="card p-6">
          <p className="text-sm text-slate-700">
            ✓ Importação concluída — {inseridas} incidências inseridas.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/incidencias" className="btn-primary">
              Ver incidências
            </Link>
            <button className="btn-secondary" onClick={() => setFase("inicio")}>
              Importar outro ficheiro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: sem erros; a rota `/incidencias/importar` aparece na listagem do build.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/incidencias/importar/page.tsx" "src/app/(app)/incidencias/importar/ImportWizard.tsx"
git commit -m "feat(import): pagina e wizard de importacao"
```

---

### Task 10: Navegação + verificação E2E

**Files:**
- Modify: `src/app/(app)/incidencias/page.tsx`

**Interfaces:**
- Consumes: rota `/incidencias/importar`.

- [ ] **Step 1: Ler o cabeçalho atual**

Run: abrir `src/app/(app)/incidencias/page.tsx` e localizar o `<PageHeader ... acao={...}>` (o botão "Nova incidência").

- [ ] **Step 2: Adicionar botão "Importar"**

Dentro do `acao` do `PageHeader`, ao lado do link/botão existente de nova incidência, adicionar (garantir `import Link from "next/link";` no topo, se ainda não existir):
```tsx
<Link href="/incidencias/importar" className="btn-secondary">
  Importar
</Link>
```
Se o `acao` for um único elemento, envolver ambos num fragmento: `acao={<><Link .../> <Link href="/incidencias/importar" className="btn-secondary">Importar</Link></>}`.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: sem erros.

- [ ] **Step 4: Correr toda a suite**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 5: Verificação manual E2E (com a app a correr)**

Pré-requisito: Task 7 Step 2 aplicado no Supabase.
1. `npm run dev`, entrar, ir a Incidências → **Importar**.
2. Carregar um `.xlsx` com as colunas reais (incluir uma linha `ACMx` e uma resolvida).
3. Confirmar a pré-visualização: novas > 0, a linha `ACMx` aparece em "Com erro".
4. Importar; ver a barra de progresso e o total.
5. Ir a Incidências e confirmar que aparecem, com estado correto (resolvida/aberta) e datas.
6. **Reimportar o mesmo ficheiro** → esperado: 0 novas, todas em "já existem".
7. Acrescentar 1 linha nova no Excel e reimportar → só essa entra.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/incidencias/page.tsx"
git commit -m "feat(import): botao Importar na lista de incidencias"
```

---

## Self-Review

- **Spec coverage:** página+upload (T9), .xlsx (T5), pré-visualização 3 grupos (T9), insert-only novas (T8), IA título/prioridade com fallback (T6), idempotência via import_ref (T2/T7/T8), mapeamento de colunas+descrição+estado (T4), schema (T7), validação/erros (T4/T8/T9). ✓
- **Placeholder scan:** sem TBD/TODO; todos os passos têm código real. ✓
- **Type consistency:** `CamposIncidencia`/`LinhaMapeada`/`ResultadoAnalise` definidos em T4 e usados igual em T8/T9; `analisarImport(FormData)`, `importarLote(CamposIncidencia[])`, `getImportRefsExistentes(string[])`, `mapearLinha(LinhaCrua, number, MapaApartamentos)`, `parseFicheiro(Uint8Array)`, `extrairTituloPrioridade(string)` consistentes entre tarefas. ✓
- **Correção face ao spec:** índice `import_ref` é único **não-parcial** (NULLs distintos em Postgres; necessário para o `ON CONFLICT` do upsert). ✓
