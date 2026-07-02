# Import de incidências a partir de Excel — Design

Data: 2026-07-02
Estado: proposta (a rever)

## Objetivo

Permitir importar incidências em massa a partir do Excel de trabalho do
utilizador, através de uma página no site. O import é **incremental**:
ao recarregar o (mesmo) ficheiro atualizado, só entram as linhas novas — as já
importadas são ignoradas.

## Requisitos

1. Página no site (`/incidencias/importar`), atrás de autenticação.
2. Carregar ficheiro **.xlsx** (e .csv) diretamente, sem exportação manual.
3. **Pré-visualização** antes de inserir, com as linhas classificadas em:
   - **Novas** — vão ser inseridas (mostra os campos mapeados).
   - **Já existem** — ignoradas (assinatura já presente na base).
   - **Com erro** — não inseridas; mostradas para correção (apartamento
     desconhecido, data inválida, PROBLEMA vazio).
4. Inserir **só as linhas novas** ao confirmar.
5. Título e prioridade gerados por **IA (Claude)** a partir do texto do PROBLEMA,
   com degradação graciosa (sem chave / erro numa linha → modo determinístico).

## Não-objetivos (v1)

- **Não** atualizar incidências já importadas (é insert-only). Mudar o RESOLVIDO
  no Excel depois de importado não altera o estado na app — isso gere-se na app.
- Sem RLS por utilizador (single-user, como o resto da app).
- Sem importação de fotos/ficheiros a partir do "Link" (guarda-se só o link em
  texto na descrição).

## Fonte: colunas do Excel

`DATA | CASA | Cidade | PROBLEMA | RESP. | Link para fotos/docs |
OBSERVAÇÕES FO | OBSERVAÇÕES HM | OBSERVAÇÕES HSK | RESOLVIDO`

## Mapeamento coluna → campo

| Coluna Excel | Campo OPSAL | Notas |
|---|---|---|
| DATA | `aberta_em` | Formato `DD/MM/YYYY`. Inválida → linha com erro. |
| CASA | `apartamento_id` | Lookup por `codigo` (upper/trim). Sem match → erro. |
| Cidade | — | Só validação (avisa se difere da região do apartamento). |
| PROBLEMA | `titulo` (IA) + `descricao` | Título = resumo IA; descrição = PROBLEMA verbatim + anexos. |
| RESP. | anexado à `descricao` | Etiqueta interna (ex.: "Resp.: HM"). |
| Link para fotos/docs | anexado à `descricao` | "Link: …" se não vazio. |
| OBSERVAÇÕES FO/HM/HSK | anexado à `descricao` | "Obs. FO/HM/HSK: …" se não vazio. |
| RESOLVIDO | `estado` (+ `resolvida_em`) | `Não`→`aberta`; `Sim`→`resolvida`, `resolvida_em = DATA`. |

**Composição da descrição:** PROBLEMA, seguido (só as não-vazias) das secções
`Obs. FO:`, `Obs. HM:`, `Obs. HSK:`, `Resp.:`, `Link:`, cada uma em linha nova.

**Título/prioridade (IA):** por cada linha nova, chama-se a extração (reaproveita
a lógica de `extrair.ts`, mas **sem** a deteção de apartamento — a casa já vem da
coluna CASA) sobre o texto do PROBLEMA para obter `titulo` e `prioridade`.
Fallback determinístico: título = primeiras ~8 palavras do PROBLEMA; prioridade
por palavras-chave (fuga/água, sem luz, gás → `alta`; estética, lâmpada →
`baixa`; resto → `media`).

## Idempotência (não duplicar)

Cada linha gera uma **assinatura** estável:

```
import_ref = sha256( `${CASA_norm}|${DATA_iso}|${PROBLEMA_norm}` )
```

- `CASA_norm`: trim + upper.
- `DATA_iso`: data convertida para `YYYY-MM-DD`.
- `PROBLEMA_norm`: trim + espaços colapsados (não lowercase, para preservar).

Guardada numa coluna nova `incidencias.import_ref` (text, nullable) com índice
único parcial. No import, calcula-se a assinatura de cada linha e consultam-se as
existentes; as que já existem entram no grupo "Já existem". Incidências criadas
à mão na app têm `import_ref = NULL` e nunca colidem.

*Limitação assumida:* editar o texto de uma linha já importada muda a assinatura
→ passa a contar como nova.

### Alteração de schema (SQL a correr no Supabase)

```sql
alter table incidencias add column if not exists import_ref text;
create unique index if not exists incidencias_import_ref_key
  on incidencias (import_ref) where import_ref is not null;
```

Adicionar também ao `db/schema.sql` para novos ambientes.

## Arquitetura e componentes

- `src/lib/import/parseXlsx.ts` — lê o ficheiro (SheetJS) → linhas cruas
  (objetos por cabeçalho). Server-only.
- `src/lib/import/mapearLinha.ts` — normaliza + mapeia uma linha crua para um
  `LinhaImport` (campos OPSAL + `import_ref` + estado de validação). Puro,
  testável isoladamente.
- `src/lib/import/extrairTitulo.ts` — extração IA focada (título/prioridade),
  com fallback determinístico. Reaproveita o cliente Anthropic de `extrair.ts`.
- `src/app/(app)/incidencias/importar/page.tsx` — UI: upload + pré-visualização
  + confirmar (client component para o estado do wizard).
- `src/app/(app)/incidencias/importar/actions.ts` — server actions:
  - `analisarImport(file)` → parse + mapeia + classifica (Novas/Existem/Erro),
    **sem** IA e **sem** inserir. Devolve o resumo para a pré-visualização.
  - `importarLote(linhasNovas)` → para um lote: corre IA (concorrência
    limitada) + insere. Devolve progresso. Chamado repetidamente pelo cliente.
- Entrada de navegação: botão "Importar" na página `/incidencias`.

## Fluxo de dados

1. Utilizador carrega ficheiro → `analisarImport` faz parse, mapeia e classifica
   (a IA **não** corre aqui). Título mostrado na pré-visualização é o fallback
   determinístico (provisório); nota-o na UI.
2. UI mostra os 3 grupos + contagens. Botão "Importar N novas".
3. Ao confirmar, o cliente envia as linhas novas em **lotes** (ex.: 15) para
   `importarLote`; cada lote corre a IA (concorrência ~5) e insere. Barra de
   progresso "Importadas X/N". Lotes evitam o tempo-limite serverless.
4. No fim: resumo (inseridas, ignoradas, erros) e ligação para a lista.

## Tratamento de erros e validação

- **Apartamento desconhecido** (ex.: `ACMx`): linha no grupo "Com erro", com o
  código apresentado; não inserida.
- **Data inválida / vazia**: erro.
- **PROBLEMA vazio**: erro.
- **Cidade ≠ região do apartamento**: aviso (não bloqueia).
- **IA falha ou sem `ANTHROPIC_API_KEY`**: fallback determinístico por linha (não
  bloqueia o import).
- **Erro de inserção de um lote**: reporta o lote falhado; os já inseridos ficam
  (import é idempotente, pode-se reimportar sem duplicar).

## Dependências

- `xlsx` (SheetJS) — parsing de .xlsx/.csv no servidor.

## Testes

- Unit (puros): `mapearLinha` (datas, RESOLVIDO, composição da descrição,
  normalização), cálculo de `import_ref` (estabilidade e sensibilidade),
  fallback determinístico de título/prioridade.
- Manual: importar um ficheiro de exemplo; reimportar e confirmar que 0 novas;
  acrescentar 1 linha e confirmar que só essa entra; linha com `ACMx` cai em erro.

## Riscos / questões em aberto

- Volume: muitas linhas × chamadas IA = tempo/custo. Mitigado por lotes e por
  correr IA só nas novas. Pode-se adicionar um teto por import se necessário.
- `xlsx` (SheetJS) tem histórico de avisos de segurança; corre só no servidor
  sobre ficheiros do próprio utilizador (risco baixo neste contexto single-user).
