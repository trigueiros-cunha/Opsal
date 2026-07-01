# OPSAL — Plataforma de Gestão de Manutenções AL

Ferramenta single-user para gerir a manutenção de um portfólio de alojamento
local (Porto, Lisboa, Algarve). Incidências, recorrentes, projetos, agenda,
técnicos e apartamentos — numa app pequena e usável todos os dias.

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres +
Storage) · React Query · Anthropic (extração WhatsApp)**. Locale **PT-PT**.

---

## Arranque rápido

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar projeto Supabase e aplicar o schema
1. Cria um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cola e corre `db/schema.sql` (cria enums, tabelas,
   índices, triggers e a view `recorrentes_estado`).
3. Em **Storage**, cria um bucket **privado** chamado `manutencao-fotos`
   (as fotos e PDFs são servidos por signed URLs).

### 3. Variáveis de ambiente
Copia `.env.example` para `.env.local` e preenche:

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secreta!) |
| `APP_PASSWORD` | Password única de entrada (à tua escolha) |
| `SESSION_SECRET` | String aleatória longa — ex.: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) (opcional) |

> ⚠️ A `service_role` key **só é usada no servidor** (`src/lib/supabase/admin.ts`
> importa `server-only`). Nunca a expõas no cliente.

### 4. Semear os 143 apartamentos
```bash
npm run seed
```
Idempotente (upsert por `codigo`). Semeia 143 ativos + 9 inativos
(`ativo = false`).

### 5. Correr
```bash
npm run dev      # desenvolvimento → http://localhost:3000
npm run build && npm start   # produção
```
Entra com a `APP_PASSWORD`.

---

## Scripts
| Comando | Efeito |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servir o build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Semear apartamentos (Anexo A) |

---

## Estrutura
```
db/schema.sql                 Schema completo + view recorrentes_estado
scripts/seed.mjs              Seed dos apartamentos
src/middleware.ts             Protege todas as rotas exceto /login
src/lib/
  auth.ts                     Cookie de sessão HMAC (Edge + Node)
  session.ts                  temSessao / exigirSessao (server)
  supabase/admin.ts           Cliente service_role (server-only)
  data/*                      Camada de acesso a dados (server-only)
  extrair.ts                  Pré-passo determinístico + Claude (WhatsApp)
  format.ts / constants.ts    PT-PT, rótulos de enums, mapas
src/app/
  login/                      Entrada por password
  (app)/                      Shell autenticado (sidebar)
    page.tsx                  Hoje (painel transversal)
    agenda/                   Vista semanal (por técnico / por dia)
    incidencias/             Lista, nova (+WhatsApp), detalhe, custos, fotos
    recorrentes/             Semáforo, gerar incidência, fecho de ciclo
    projetos/                Fases, orçamento (PDF), aprovação, custos
    tecnicos/                Cartões com carga
    apartamentos/            Lista oficial por região + procura
  api/
    auth/{login,logout}      Sessão
    incidencias/extrair      Extração WhatsApp → JSON
    agenda                   Eventos da semana
src/components/               UI partilhada (Badges, CustosEditor, FotosPanel…)
```

---

## Decisões assumidas (podes mudar)

- **VHAF* → região `porto`.** Aparecem na folha de Porto do portal Saferent.
  A `regiao` é **editável por apartamento** (em `/apartamentos`), por isso podes
  passar qualquer VHAF para Algarve (Vilamoura) sem migração. Ver aviso no
  Anexo A do brief.
- **Inativos** (TRIND1-7, URBAL1, URBSC4) entram com `ativo = false` — existem
  como fonte de verdade mas ficam filtrados por defeito.
- **Aprovação do proprietário = registo manual** (`aprovado_em`/`aprovado_nota`).
  Não há portal de owner. Registar aprovação move o projeto para `execucao`.
- **Extração WhatsApp** usa o modelo **`claude-sonnet-4-6`** (definido no brief,
  secção 5). Se esse id não existir na tua conta, ajusta `MODELO` em
  `src/lib/extrair.ts` para um Sonnet válido. Sem `ANTHROPIC_API_KEY`, a extração
  degrada graciosamente (pré-passo determinístico do apartamento + defaults).
- **Sem RLS por utilizador** (single-user). Toda a escrita passa por Server
  Actions / route handlers com a `service_role` key.

---

## Ligações futuras (desenhadas, não construídas)
- **Plataforma de stock:** `incidencia_custos.origem_stock` + `stock_item_id` já
  existem no schema para baixa automática e preço pré-preenchido.
- Navegação de semanas na agenda já funciona por janela real (`?inicio=`).
- Histórico por apartamento e rota de técnico por zona (Haversine) — futuros.
