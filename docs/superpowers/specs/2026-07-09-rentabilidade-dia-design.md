# Rentabilidade do dia — novo modelo de custo — Design

Data: 2026-07-09
Estado: proposta (aprovada em brainstorming, a rever no ficheiro)

## Problema

O modelo atual julga a rentabilidade de uma **incidência isolada**
(`preço − mão de obra por tempo − deslocação − materiais = resultado`). Isso está
errado: o técnico custa à empresa um **dia inteiro** (é pago quer registe 3h quer
8h de tarefas), não só os minutos lançados. Além disso o "Resultado" (baseado no
tempo registado) e a barra de break-even (baseada no custo do dia completo) usam
bases diferentes — inconsistente.

O que se quer: por técnico e por dia, saber se o **conjunto do dia** (tarefas +
deslocações + trabalhos que se cobram aos owners) cobre o custo de ter o técnico —
lucro, break-even ou prejuízo (o serviço feito pode nem chegar para a deslocação).

## Decisões (fechadas em brainstorming)

1. **Custo do técnico = dia completo (fixo):** `horas_dia_padrao ×
   custo_hora_carregado`, contado **uma vez** por técnico/dia (não a soma dos
   minutos lançados).
2. **Por incidência = contribuição** (não lucro/prejuízo isolado):
   `contribuição = preço_proprietário − deslocação − materiais` (materiais = só
   `incidencia_custos` de `tipo='material'`). **Sem mão de obra** ao nível da
   incidência.
3. **Veredito ganhar/BE/perder vive no dia** (`/rentabilidade`).
4. **Obras (projetos) ficam fora do P&L do dia:** duram semanas e não há registo
   de que dias o técnico lá esteve; mantêm o **P&L por obra** (orçamento vs
   custos) inalterado.
5. **"Não rentáveis" = incidências com contribuição < 0** (o preço nem cobre
   deslocação + materiais) + obras concluídas com resultado < 0.
6. **Sem alterações de schema.** `config.horas_dia_padrao` e
   `config.taxa_encargos_pct` já existem; é só recálculo + apresentação.

## Fórmulas

Por incidência:
```
contribuicao = round2(preco_proprietario − deslocacao_valor − Σ materiais(tipo='material'))
```

Por técnico/dia:
```
custo_dia         = round2(horas_dia_padrao × custo_hora_carregado)   -- 1× por técnico
contribuicao_dia  = round2(Σ contribuicao das incidências resolvidas nesse dia)
resultado         = round2(contribuicao_dia − custo_dia)
receita_dia       = round2(Σ preco_proprietario)
deslocacoes_dia   = round2(Σ deslocacao_valor)
materiais_dia     = round2(Σ materiais)
ocupacao_pct      = horas_dia_padrao > 0 ? round((Σ tempo/60) / horas_dia_padrao × 100) : 0
break_even_pct    = custo_dia > 0 ? round(contribuicao_dia / custo_dia × 100) : 0
```

`resultado = contribuicao_dia − custo_dia` e também
`= receita_dia − custo_dia − deslocacoes_dia − materiais_dia` (identidade — servem
de teste). Bucket "sem técnico": mostra contribuição mas sem `custo_dia`/break-even
(custo_dia = 0).

## Camada de cálculo — `src/lib/custo.ts`

- **Novo tipo** `Contribuicao { receita; custoDeslocacao; custoMateriais;
  contribuicao }` e função pura
  `contribuicaoIncidencia({ deslocacaoValor, custosMateriais, precoProprietario })
  : Contribuicao`.
  - Substitui o uso de `plIncidencia` para incidências. `plIncidencia`/`PL`
    (custoTempo…) deixam de ser usados por incidências — remover se ficarem
    órfãos, mantendo o que os projetos usam.
- **`plProjeto` e `PL`** ficam **como estão** (obras usam-nos). **`maoDeObra`,
  `totalIncidencia`, `formatarTempo`** também se mantêm (usados por `registo.ts` e
  pelo editor de trabalho da incidência) — **não remover**.
- **`ResumoDia`** passa a ter: `receita, custoDia, deslocacoes, materiais,
  contribuicao, resultado, nIntervencoes, minutosProdutivos, ocupacaoPct,
  breakEvenPct`. (Substitui os campos antigos `custoTotal`/`custoFixoDia`.)
- **`resumoTecnicoDia(itens: { contrib: Contribuicao; tempoMinutos: number|null }[],
  cfg: { horasDiaPadrao; custoHoraCarregado }): ResumoDia`** — aplica as fórmulas
  acima. `custoHoraCarregado` continua a ser o do técnico do grupo.
- `custoHoraCarregado(base, taxaPct)` mantém-se.
- **Testes (TDD)** em `custo.test.ts`: `contribuicaoIncidencia` (com/sem preço, só
  materiais tipo material implícito via input, deslocação); `resumoTecnicoDia`
  (resultado = contribuição − custo_dia; identidade com receita−custos; break-even;
  guards 0 horas / lista vazia; bucket sem técnico com custo_dia 0). Atualizar/
  substituir os testes antigos de `plIncidencia`/`resumoTecnicoDia`.

## Camada de dados — `src/lib/data/rentabilidade.ts`

- `ItemPL` → `ItemContrib { id; titulo; apartamento_codigo; tempoMinutos;
  contrib: Contribuicao }`.
- `resumoDia(dataISO)`: para cada incidência resolvida nesse dia calcula
  `contribuicaoIncidencia`; agrupa por técnico; por grupo chama `resumoTecnicoDia`
  com o `custoHoraCarregado` do técnico (bucket "sem técnico" → custoHora 0).
  `ResumoTecnico { tecnico; resumo: ResumoDia; itens: ItemContrib[] }`.
- `getPLIncidencia(id)` → `getContribIncidencia(id): Promise<Contribuicao | null>`.
- `getPLProjeto` — inalterado.
- `listNaoRentaveis()`: incidências (resolvidas/fechadas) com `contribuicao < 0`
  (ordenadas pela pior) + projetos `concluido` com `rentabilidade < 0`. A
  `LinhaNaoRentavel` passa a levar o valor negativo relevante (contribuição para
  inc, rentabilidade para proj) no mesmo campo `valor`.

## UI

- **Cartão na incidência** (`src/components/PLBreakdown.tsx` → novo
  `ContribBreakdown` ou adaptar): mostra
  `Receita · − Deslocação · − Materiais · = Contribuição` (verde ≥0 / vermelho <0)
  + nota curta: "A mão de obra do técnico é contada no dia (ver Rentabilidade)".
  Se sem preço → "Preço por definir" e receita 0.
  - O `PLBreakdown` atual (Resultado) **continua** a ser usado pelo **projeto**.
    Se o `ContribBreakdown` for um componente novo, o `PLBreakdown` fica só para
    projetos; o detalhe da incidência passa a usar o novo.
- **Dashboard do dia** (`CartaoTecnico.tsx`): linhas
  `Receita · − Custo do dia (técnico) · − Deslocações · − Materiais · = Resultado`;
  barra **break-even** = `contribuicao_dia / custo_dia` (cap 100% na barra, %
  real no rótulo); **ocupação**. Aviso a vermelho se algum técnico `resultado < 0`
  (já existe — manter).
- **Lista "não rentáveis"** (`/rentabilidade`): usa `valor` (contribuição/
  rentabilidade) negativo; rótulo por tipo (Incidência/Obra) como já faz.

## Tratamento de erros / casos-limite

- Sem preço → receita 0 → contribuição = −(deslocação+materiais) (pode ser <0 → não
  rentável). UI sinaliza "Preço por definir".
- Sem técnico → incidência entra no bucket "sem técnico": mostra contribuição, sem
  custo_dia nem break-even.
- `horas_dia_padrao = 0` ou `custo_dia = 0` → break-even/ocupação = 0 (guards).
- `custo_dia` contado **uma vez** por técnico/dia, independentemente do nº de
  incidências.
- Arredondamento a 2 casas em todos os euros.

## Testes

- Unit (vitest, puros): como em "Camada de cálculo".
- Manual: numa incidência com preço, deslocação e material → o cartão mostra
  Contribuição (e negativa quando o preço não cobre a deslocação). No
  `/rentabilidade`, um técnico com incidências resolvidas nesse dia → Resultado =
  Σ contribuição − custo do dia; break-even coerente; a incidência cujo preço não
  cobre a deslocação aparece em "não rentáveis".

## Ficheiros

**Modificar:**
- `src/lib/custo.ts` (+ `src/lib/custo.test.ts`) — `contribuicaoIncidencia`,
  `Contribuicao`, `ResumoDia`/`resumoTecnicoDia` novos; remover uso de
  `plIncidencia` por incidências.
- `src/lib/data/rentabilidade.ts` — `resumoDia`, `getContribIncidencia`,
  `listNaoRentaveis`, tipos `ItemContrib`/`ResumoTecnico`.
- `src/components/PLBreakdown.tsx` — novo `ContribBreakdown` (ou variante) para a
  incidência; `PLBreakdown` mantém-se para o projeto.
- `src/app/(app)/incidencias/[id]/page.tsx` — usar o cartão de contribuição.
- `src/app/(app)/rentabilidade/CartaoTecnico.tsx` — novas linhas/labels.
- `src/app/(app)/rentabilidade/page.tsx` — só se os nomes de campos do resumo
  mudarem (ajustar `algumNegativo`/uso de `naoRentaveis`).
- `src/app/(app)/projetos/[id]/page.tsx` — inalterado (confirmar que continua a
  compilar com `PLBreakdown`).

**Sem alterações:** `db/schema.sql`, `types.ts` (a não ser tipos de UI), `config`.

## Fora de âmbito

- Registo de tempo por dia em projetos / obras no P&L do dia.
- Alterar o "Registo para a empresa" (continua no custo base, intocado).
- Horas extra / dias parciais no custo do técnico (fica o dia fixo).
- Faturação real; markup sobre materiais.
