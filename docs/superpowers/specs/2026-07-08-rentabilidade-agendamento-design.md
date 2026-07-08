# Rentabilidade (Workometer) + Agendar incidências — Design

Data: 2026-07-08
Estado: proposta (aprovada em brainstorming, a rever no ficheiro)

## Objetivo

Duas peças ligadas, ambas assentes no modelo de dados **já existente**
(`incidencias`, `projetos`, `tecnicos`), sem introduzir uma tabela `intervencoes`
paralela:

1. **Rentabilidade (Workometer):** responder, por técnico e por dia, a "estamos a
   ganhar ou a perder dinheiro com cada intervenção?". P&L operacional =
   `receita − (custo de tempo + deslocação + materiais)`.
2. **Agendar incidências:** marcar uma incidência para um dia futuro e vê-la
   aparecer no dia certo na Agenda (hoje aparece pela data de criação).

## Contexto no codebase (o que já existe)

- `tecnicos.custo_hora` (base) + `maoDeObra()`/`totalIncidencia()`/`formatarTempo()`
  em `src/lib/custo.ts`.
- `incidencias.tempo_minutos`, `deslocacao_modo`, `deslocacao_valor` (manuais).
- `incidencia_custos` com `tipo in (mao_obra, material, deslocacao)`.
- Preventivas entram como incidências: `gerarIncidenciaDeRecorrente` cria uma
  incidência com `recorrente_id` (e chega a semear uma linha de custo `mao_obra`).
- Projetos: `orcamento_valor` (preço ao proprietário), `proprietario_nome`,
  `projeto_custos`, `tecnico_id`, `fase` (`concluido` = terminado).
- `mudarEstado` preenche `resolvida_em` ao resolver/fechar (data para o P&L diário).
- Agenda: `eventosDaSemana` coloca a incidência pela `aberta_em`.

## Decisões (fechadas em brainstorming)

1. **Unidade do P&L:** incidências (avarias + preventivas, que já são incidências)
   e projetos (obras). Duas fontes, unidas em TS.
2. **Receita das incidências:** novo campo manual `incidencias.preco_proprietario`.
   Obras usam `orcamento_valor` (já existe).
3. **Deslocação:** manual, como hoje (sem geo/km, sem API de routing na v1).
4. **Encargos (custo carregado):** tabela `config` global de linha única
   (`taxa_encargos_pct`, `horas_dia_padrao`). Aplica-se a todos os técnicos.
5. **Camada de cálculo:** TS puro em `src/lib/custo.ts` (não view SQL), com a
   agregação na camada de dados. Consistente com `custo.ts`/`registo.ts`.
6. **Custo carregado só no Workometer.** O cartão "Registo para a empresa"
   mantém-se **intocado** (usa o `custo_hora` base). São artefactos diferentes:
   externo vs. gestão interna.
7. **Agendamento:** nova coluna `incidencias.agendada_em date`. A agenda passa a
   usar a **data efetiva** `COALESCE(agendada_em, aberta_em::date)`. Só data (a
   agenda é diária); não-agendadas mantêm-se visíveis no dia de criação.

### Regra anti-dupla-contagem (crítica)

Na mesma incidência o trabalho pode existir de duas formas: `tempo_minutos`
(× custo/hora) **ou** uma linha `incidencia_custos` de `tipo='mao_obra'`. Para o
P&L, a definição **canónica** é:

```
custo_tempo     = maoDeObra(tempo_minutos, custo_hora_carregado)
custo_deslocacao = deslocacao_valor
custo_materiais  = Σ incidencia_custos WHERE tipo = 'material'   -- só materiais
```

Ou seja, as linhas de custo de `tipo` `mao_obra` e `deslocacao` são **ignoradas**
no P&L (já cobertas pelos campos dedicados). Consequência aceite e intencional: o
"custo estimado" do Registo (soma **todas** as linhas, à taxa **base**) e a
rentabilidade do Workometer (taxa **carregada**) podem divergir.

### Projetos (obras) vs. "dia"

Projetos duram semanas → **não** entram no dashboard diário. Têm um **P&L por
obra**: `orcamento_valor − Σ projeto_custos`, realizado quando `fase='concluido'`.
Aparecem no detalhe do projeto e na lista "não rentáveis". Sem campos novos em
projetos (as linhas `projeto_custos` já suportam `mao_obra`/`material`).

## Modelo de dados

SQL a correr no Supabase (e a juntar a `db/schema.sql`):

```sql
-- Config global (linha única) — encargos + break-even
create table if not exists config (
  id                int primary key default 1,
  taxa_encargos_pct numeric(5,2) not null default 23.75,
  horas_dia_padrao  numeric(4,2) not null default 8.00,
  moeda             text not null default 'EUR',
  atualizado_em     timestamptz not null default now(),
  check (id = 1)
);
insert into config (id) values (1) on conflict (id) do nothing;

-- Receita da incidência (preço ao proprietário)
alter table incidencias add column if not exists preco_proprietario numeric(10,2);

-- Agendamento da incidência (data planeada da visita)
alter table incidencias add column if not exists agendada_em date;
```

Projetos: sem alterações.

`src/lib/types.ts`:
- `interface Config { id, taxa_encargos_pct, horas_dia_padrao, moeda, atualizado_em }`.
- `Incidencia` ganha `preco_proprietario: number | null` e `agendada_em: string | null`.
- `IncidenciaComRelacoes` herda ambos (já traz `tecnico.custo_hora`).

## Cálculo — `src/lib/custo.ts` (TS puro, testável)

Mantém as funções existentes (`maoDeObra`, `totalIncidencia`, `formatarTempo`) que
o `registo.ts` usa. Acrescenta:

```
custoHoraCarregado(base, taxaPct): number
   = round2(base × (1 + taxaPct/100))

plIncidencia({ tempoMinutos, custoHoraCarregado, deslocacaoValor,
               custosMateriais, precoProprietario }): PL
   custoTempo     = maoDeObra(tempoMinutos, custoHoraCarregado) ?? 0
   custoDeslocacao = deslocacaoValor ?? 0
   custoMateriais  = custosMateriais ?? 0
   custoTotal     = round2(custoTempo + custoDeslocacao + custoMateriais)
   receita        = precoProprietario ?? 0
   rentabilidade  = round2(receita − custoTotal)

plProjeto({ custos, orcamentoValor }): PL
   custoTotal    = round2(custos)
   receita       = orcamentoValor ?? 0
   rentabilidade = round2(receita − custoTotal)

// itens: um por intervenção realizada — junta o PL e os minutos de trabalho.
resumoTecnicoDia(itens: { pl: PL, tempoMinutos: number|null }[],
                 { horasDiaPadrao, custoHoraCarregado }): ResumoDia
   receita          = Σ item.pl.receita
   custoTotal       = Σ item.pl.custoTotal
   resultado        = round2(receita − custoTotal)
   nIntervencoes    = itens.length
   minutosProdutivos = Σ (item.tempoMinutos ?? 0)
   custoFixoDia     = round2(horasDiaPadrao × custoHoraCarregado)  // rate DESTE técnico
   ocupacaoPct      = horasDiaPadrao > 0
                        ? round((minutosProdutivos/60) / horasDiaPadrao × 100) : 0
   breakEvenPct     = custoFixoDia > 0 ? round(receita / custoFixoDia × 100) : 0
```

`PL` expõe `custoTempo, custoDeslocacao, custoMateriais, custoTotal, receita,
rentabilidade` para a UI consumir sem recalcular. Tipos (`PL`, `ResumoDia`)
exportados de `custo.ts`. Arredondamento a 2 casas, como no resto do ficheiro.
`custoHoraCarregado` no `resumoTecnicoDia` é o do técnico do grupo; o bucket
"sem técnico" não tem custo/hora → `custoFixoDia = 0` e break-even/ocupação = 0.

## Camada de dados (server-only)

`src/lib/data/config.ts`:
- `getConfig(): Promise<Config>` — lê a linha 1; se ausente devolve os defaults
  (23.75 / 8) sem falhar.
- `updateConfig(patch)`.

`src/lib/data/rentabilidade.ts`:
- `resumoDia(dataISO)`: incidências com `estado in (resolvida,fechada)` e
  `resolvida_em::date = dataISO`, join `tecnico (custo_hora)`; carrega os
  `incidencia_custos` (`tipo='material'`) dessas incidências e soma por incidência;
  calcula `plIncidencia` (taxa carregada da `config`); agrupa por `tecnico_id`
  (mais bucket "sem técnico") e devolve `{ tecnico, resumo, itens[] }[]`.
- `getPLIncidencia(id)` e `getPLProjeto(id)`: para os cartões de detalhe.
- `listNaoRentaveis()`: incidências resolvidas/fechadas com `rentabilidade < 0` +
  projetos `concluido` com `rentabilidade < 0`, ordenadas pela pior primeiro.

Agregação feita em memória depois do fetch (mesmo padrão do filtro de região em
`listIncidencias`). Datas em fuso local via helpers de `format.ts`.

## Agenda — data efetiva

`src/lib/data/agenda.ts`, `eventosDaSemana`: a parte das incidências passa a
selecionar também `agendada_em` e a colocar cada evento em
`COALESCE(agendada_em, aberta_em::date)`. Para a janela da semana (`[inicio,
fim)`), duas queries às incidências ativas (`estado not in (resolvida,fechada)`):
1. `agendada_em >= inicioStr AND agendada_em < fimStr` (agendadas na janela);
2. `agendada_em IS NULL AND aberta_em ∈ [inicio, fim)` (não-agendadas criadas na
   janela).
Concatenar; `evento.data` = data efetiva. Recorrentes e projetos ficam iguais.

## UI

Rótulo na aplicação: **Rentabilidade** (Workometer é o codinome). Denso e rápido,
PT-PT, reutilizando `card`/`StatCard`/`Badges` existentes.

1. **Navegação:** nova entrada **Rentabilidade** (ícone `€`) na `Sidebar`, rota
   `/rentabilidade`.
2. **Dashboard diário** `/rentabilidade` (Server Component, `force-dynamic`):
   - Seletor de data (default hoje).
   - Um cartão por técnico com intervenções realizadas nesse dia:
     **resultado líquido** (verde ≥0 / vermelho <0), receita, custo, nº
     intervenções, horas produtivas, **ocupação %**, barra **break-even** (% do
     custo fixo diário coberto pela receita). Aviso visível se algum técnico
     negativo.
   - Painel **"Não rentáveis"** por baixo (lista de `listNaoRentaveis`, com link
     ao detalhe).
   - (Extra opcional) secção "Projeção do dia": incidências `agendada_em = data`
     ainda não resolvidas — separada do realizado.
3. **Cartão "Rentabilidade" no detalhe da incidência**
   (`incidencias/[id]/page.tsx`): breakdown `receita − (tempo + deslocação +
   materiais) = resultado`. Se sem preço → mostra "preço por definir" e trata
   receita como 0.
4. **Campo "Agendada para"** (input date) e **"Preço ao proprietário (€)"** no
   `IncidenciaEditor`, gravados no mesmo **Guardar** (via `atualizarIncidencia`).
   Opcional: "Agendar para" no `NovaIncidenciaForm`.
5. **Cartão "Rentabilidade" no detalhe do projeto** (`projetos/[id]/page.tsx`):
   `orcamento_valor − Σ projeto_custos = resultado`.
6. **Configuração** `/rentabilidade/config`: form pequeno para `taxa_encargos_pct`
   e `horas_dia_padrao` (grava via `guardarConfig`).
7. **Chip da agenda** (`AgendaView`): marcador `✎` nas incidências com
   `agendada_em` (distingue de "só criada"). Detalhe menor, não bloqueante.

## Server actions

- `atualizarIncidencia` (`incidencias/actions.ts`): patch ganha `preco_proprietario`
  e `agendada_em` (string vazia → null).
- `criarIncidencia`/`criarIncidenciaObj`: aceitam `agendada_em` opcional.
- `guardarConfig(formData)`: novo em `src/app/(app)/rentabilidade/actions.ts`
  (lê `taxa_encargos_pct`, `horas_dia_padrao`; `updateConfig`; `revalidatePath`).
- Projetos: nenhuma nova (o `orcamento_valor` já é editável).

## Tratamento de erros / casos-limite

- Sem `preco_proprietario` → receita 0 → resultado = −custo; UI sinaliza
  "preço por definir" (não bloqueia).
- Sem técnico → `custo_hora` indisponível → custo de tempo 0; a incidência conta
  no bucket "sem técnico" e fica fora da ocupação/break-even por técnico.
- `config` ausente → defaults (23.75 / 8).
- `horas_dia_padrao = 0` → guard: ocupação/break-even = 0 (sem divisão por zero).
- Incidência resolvida sem tempo → custo de tempo 0.
- Arredondamento a 2 casas em todos os euros.
- Agendamento com data inválida/vazia → `agendada_em` null (cai no dia de criação).

## Testes

- Unit (vitest, puros) em `custo.test.ts`:
  - `custoHoraCarregado` (base+encargos, taxa 0).
  - `plIncidencia`: com/sem técnico, com/sem preço, materiais somam só
    `tipo='material'` (linhas `mao_obra`/`deslocacao` não entram).
  - `plProjeto`.
  - `resumoTecnicoDia`: agregação, ocupação, break-even, guards (0 horas,
    lista vazia).
- Manual:
  - Definir preço numa incidência resolvida → ver P&L no detalhe e no dashboard.
  - Agendar uma incidência para outro dia → confirmar que muda de dia na Agenda;
    não-agendada continua no dia de criação.
  - Dashboard do dia (resultado/ocupação/break-even), lista "não rentáveis",
    editar config e ver o efeito no custo carregado.

## Ficheiros

**Criar:**
- `src/lib/data/config.ts`
- `src/lib/data/rentabilidade.ts`
- `src/app/(app)/rentabilidade/page.tsx` (dashboard diário)
- `src/app/(app)/rentabilidade/actions.ts` (`guardarConfig`)
- `src/app/(app)/rentabilidade/config/page.tsx`
- Componentes de UI dos cartões de P&L (incidência/projeto) e cartões por técnico
  (ex.: `src/app/(app)/rentabilidade/CartaoTecnico.tsx`,
  `src/components/PLBreakdown.tsx`).

**Modificar:**
- `db/schema.sql` (`config`, `preco_proprietario`, `agendada_em`)
- `src/lib/types.ts` (`Config`, campos novos em `Incidencia`)
- `src/lib/custo.ts` (+ `custo.test.ts`)
- `src/lib/constants.ts` (rótulo de navegação, se aplicável)
- `src/components/Sidebar.tsx` (entrada "Rentabilidade")
- `src/lib/data/agenda.ts` (data efetiva)
- `src/app/(app)/incidencias/actions.ts` (`preco_proprietario`, `agendada_em`)
- `src/app/(app)/incidencias/[id]/IncidenciaEditor.tsx` (2 campos novos)
- `src/app/(app)/incidencias/[id]/page.tsx` (cartão Rentabilidade)
- `src/app/(app)/incidencias/nova/NovaIncidenciaForm.tsx` (agendar — opcional)
- `src/app/(app)/projetos/[id]/page.tsx` (cartão Rentabilidade)
- `src/app/(app)/agenda/AgendaView.tsx` (marcador de agendada — opcional)

## Fora de âmbito (v1)

- Auto-km/geo (morada+coordenadas dos apartamentos, ponto de partida, API de
  routing) e modo-rota.
- Catálogo `tipos_tarefa` com preços por defeito.
- Encargos por técnico (fica só a taxa global).
- Hora (além da data) no agendamento.
- Faturação real ao proprietário (o preço é só para medir rentabilidade).
- Alterar o "Registo para a empresa" (mantém-se no custo base).
