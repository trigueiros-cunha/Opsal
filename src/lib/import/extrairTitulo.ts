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
