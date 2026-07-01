import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ExtracaoIncidencia, Origem, Prioridade } from "@/lib/types";

// Modelo definido no brief (secção 5) — Sonnet por custo.
const MODELO = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `És um assistente que extrai dados de manutenção de mensagens (geralmente WhatsApp de
hóspedes ou equipa). Devolve APENAS JSON válido, sem texto à volta, com:
{
  "titulo": "resumo curto do problema, máx 6 palavras",
  "descricao": "detalhe relevante, limpo de saudações e ruído",
  "prioridade": "alta" | "media" | "baixa",
  "origem_sugerida": "hospede" | "limpeza_hk" | "front_office" | "inspecao" | "proprietario"
}
Regras de prioridade:
- alta: fuga de água, inundação, sem luz, sem internet, cheiro a gás, fumo, porta que não tranca, segurança
- baixa: estética, lâmpada fundida, pilha, "quando puder", "sem pressa"
- media: tudo o resto
Não inventes o apartamento; isso é tratado fora.`;

const PRIORIDADES: Prioridade[] = ["alta", "media", "baixa"];
const ORIGENS: Origem[] = [
  "hospede",
  "limpeza_hk",
  "front_office",
  "inspecao",
  "proprietario",
];

/** Pré-passo determinístico: procura qualquer código oficial no texto. */
async function detetarApartamento(texto: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("apartamentos")
    .select("codigo");
  if (error) throw error;
  const codigos = (data ?? []).map((r) => (r as { codigo: string }).codigo);
  const upper = texto.toUpperCase();
  // Match por limite de palavra para evitar falsos positivos.
  for (const codigo of codigos) {
    const re = new RegExp(`\\b${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(upper)) return codigo;
  }
  return null;
}

function limparJson(bruto: string): string {
  let s = bruto.trim();
  // Tira fences ```json ... ```
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  // Se houver preâmbulo, agarra do primeiro { ao último }.
  const inicio = s.indexOf("{");
  const fim = s.lastIndexOf("}");
  if (inicio >= 0 && fim > inicio) s = s.slice(inicio, fim + 1);
  return s;
}

export async function extrairIncidencia(
  texto: string,
): Promise<ExtracaoIncidencia> {
  const codigo = await detetarApartamento(texto);

  // Defaults defensivos (secção 5, ponto 4).
  const fallback: ExtracaoIncidencia = {
    apartamento_codigo: codigo,
    apartamento_reconhecido: Boolean(codigo),
    titulo: texto.slice(0, 60).trim() || "Incidência",
    descricao: texto.trim(),
    prioridade: "media",
    origem_sugerida: "hospede",
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Sem chave, devolve o pré-passo + defaults (não bloqueia o fluxo).
    return fallback;
  }

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODELO,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: texto }],
    });

    const bruto = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = JSON.parse(limparJson(bruto)) as Partial<ExtracaoIncidencia>;

    const prioridade = PRIORIDADES.includes(parsed.prioridade as Prioridade)
      ? (parsed.prioridade as Prioridade)
      : "media";
    const origem = ORIGENS.includes(parsed.origem_sugerida as Origem)
      ? (parsed.origem_sugerida as Origem)
      : "hospede";

    return {
      apartamento_codigo: codigo,
      apartamento_reconhecido: Boolean(codigo),
      titulo: (parsed.titulo || fallback.titulo).slice(0, 120),
      descricao: parsed.descricao || fallback.descricao,
      prioridade,
      origem_sugerida: origem,
    };
  } catch {
    // Parse/timeout/erro de API → defaults com o pré-passo.
    return fallback;
  }
}
