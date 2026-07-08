# Trabalho, deslocação e "Registo para a empresa" — Design

Data: 2026-07-08
Estado: proposta (a rever)

## Objetivo

Reduzir o trabalho de fechar incidências e de as registar na plataforma externa
da empresa. Três partes ligadas:

1. **Tempo de trabalho** por incidência, valorizado em € quando há técnico.
2. **Deslocação** por incidência (modo + valor).
3. **Registo para a empresa**: um painel que gera, pronto a copiar, exatamente os
   4 campos do formulário "Maintenance resolution" da plataforma da empresa.

## Contexto (plataforma da empresa)

O formulário "Maintenance resolution" tem 4 campos:
1. *How you solved the maintenance issue* → o que foi feito.
2. *Invoices … costs without VAT* → custos com fatura, **sem IVA**.
3. *Other costs … no invoice* → custos sem fatura, em texto (ex.: "deslocação
   carrinha", "GC dedicou 1h30 no local a resolver o problema").
4. *Estimated cost* → um total.

## Decisões

- **Mão de obra:** €/hora vem do **técnico atribuído** (`tecnicos.custo_hora`).
  Sem técnico → regista-se o tempo mas **sem €** (não há valor por defeito).
- **Deslocação:** valor **manual**; modo de uma lista (carro, uber, trotinete,
  carrinha) + **"outro"** que permite escrever um modo novo.
- **Custos a contabilizar** (campo 2): serviços pagos, materiais, loiças, etc. —
  a tabela `incidencia_custos` já existente. Metem-se **sem IVA**.
- "O que foi feito" usa a coluna existente `notas_resolucao`.

## Não-objetivos (v1)

- Sem integração/API com a plataforma da empresa (é copiar-colar manual).
- Sem cálculo de IVA (os custos entram líquidos, como a empresa pede).
- Sem histórico de tarifas: a mão de obra é calculada com o `custo_hora` atual do
  técnico (se este mudar, o valor recalcula — aceitável para uso interno).

## Modelo de dados

Acrescentar a `incidencias`:
- `tempo_minutos int` (nullable) — tempo de trabalho.
- `deslocacao_modo text` (nullable) — modo (guarda o texto; se "outro", guarda o
  que for escrito).
- `deslocacao_valor numeric(10,2)` (nullable) — valor da deslocação (manual).

SQL a correr no Supabase (e a juntar ao `db/schema.sql`):
```sql
alter table incidencias add column if not exists tempo_minutos int;
alter table incidencias add column if not exists deslocacao_modo text;
alter table incidencias add column if not exists deslocacao_valor numeric(10,2);
```

## Cálculos

- **Mão de obra (€):** se há técnico com `custo_hora` > 0 e `tempo_minutos` > 0 →
  `(tempo_minutos / 60) * custo_hora`. Senão → sem valor (null).
- **Total da incidência (custo estimado):** `soma(custos) + maoDeObra(€ ou 0) +
  (deslocacao_valor ou 0)`.

Funções puras num módulo testável `src/lib/custo.ts`:
- `maoDeObra(tempoMinutos, custoHora): number | null`
- `totalIncidencia({ custos, maoDeObra, deslocacaoValor }): number`
- `formatarTempo(tempoMinutos): string` → "1h30", "45min", "" se 0/null.

## UI — detalhe da incidência

**Cartão novo "Trabalho & deslocação"** (client component `TrabalhoEditor`):
- **Tempo:** dois campos (horas, minutos) → `tempo_minutos`. Mostra o € de mão de
  obra (ou "sem técnico — sem valor" quando não há técnico/tarifa).
- **Deslocação:** `select` de modo (carro/uber/trotinete/carrinha/outro). Se
  "outro" → aparece um campo de texto para o modo. + campo de valor (€).
- **O que foi feito:** `textarea` (`notas_resolucao`).
- Botão **Guardar**. Grava via server action `guardarTrabalho`.

**Cartão "Registo para a empresa"** (client component `RegistoEmpresa`) — 4
secções, cada uma com botão **Copiar** (usa `navigator.clipboard`), a mapear 1:1
com o formulário da empresa:
1. **Como foi resolvido** → `notas_resolucao`.
2. **Faturas e custos (sem IVA)** → lista dos `incidencia_custos`, uma linha por
   item: `"<descrição> — <qtd> x <valor_unitario>€ = <total>€"`.
3. **Outros custos (sem fatura)** → frase automática no estilo dos exemplos:
   - deslocação (se houver): `"Deslocação em <modo>."` (+ ` (<valor>€)` se tiver
     valor).
   - tempo (se houver): `"<iniciais/nome do técnico> dedicou <tempo> no local a
     resolver o problema."` (sem técnico: `"Trabalho no local: <tempo>."`).
4. **Custo estimado** → total (número, ex.: `"37.50"`).

Mais um botão **Copiar tudo** (junta as 4 secções rotuladas).

O cálculo e a formatação do texto de cada secção são feitos por uma função pura
`construirRegisto(incidencia, custos, tecnico)` em `src/lib/registo.ts`, para ser
testável sem UI.

## Server actions (`incidencias/actions.ts`)

- `guardarTrabalho(formData)`: lê `id`, `tempo_minutos` (de horas+minutos),
  `deslocacao_modo`, `deslocacao_valor`, `notas_resolucao`; `update` na
  incidência; `revalidatePath` do detalhe.

## Camada de dados

`getIncidencia` já devolve a incidência com o técnico (join). Acrescentar os novos
campos ao tipo `Incidencia`/`IncidenciaComRelacoes` em `src/lib/types.ts` e
garantir que `custo_hora` do técnico vem no select (já vem `tecnico: (id, nome,
iniciais)` — **acrescentar `custo_hora`**).

## Tratamento de erros

- Valores em branco → tempo/deslocação nulos (não bloqueiam).
- `navigator.clipboard` indisponível (contexto não seguro) → fallback: seleciona
  o texto num `textarea` escondido e mostra "copiado" / instrução.
- Sem técnico → mão de obra null; o registo usa a frase sem valor.

## Testes

- Unit (puros): `custo.ts` (maoDeObra com/sem técnico, total, formatarTempo),
  `registo.ts` (as 4 secções, com/sem deslocação, com/sem técnico, custos vazios).
- Manual: gravar tempo/deslocação, ver € e total; copiar cada secção e colar no
  formulário da empresa.

## Ficheiros

- Modify: `db/schema.sql` (3 colunas)
- Modify: `src/lib/types.ts` (campos novos + `custo_hora` no técnico do join)
- Modify: `src/lib/data/incidencias.ts` (select inclui `custo_hora` e novos campos)
- Create: `src/lib/custo.ts` (+ teste)
- Create: `src/lib/registo.ts` (+ teste)
- Modify: `src/app/(app)/incidencias/actions.ts` (`guardarTrabalho`)
- Create: `src/app/(app)/incidencias/[id]/TrabalhoEditor.tsx`
- Create: `src/app/(app)/incidencias/[id]/RegistoEmpresa.tsx`
- Modify: `src/app/(app)/incidencias/[id]/page.tsx` (render dos 2 cartões)
