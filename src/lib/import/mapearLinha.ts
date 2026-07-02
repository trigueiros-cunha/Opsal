import type { LinhaCrua, LinhaMapeada, MapaApartamentos } from "./tipos";
import { calcularImportRef, dataParaIso, normalizarCasa } from "./chave";
import { prioridadePorPalavrasChave, tituloCurto } from "./heuristicas";

const DIACRITICOS = /[̀-ͯ]/g;

function normHeader(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
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
    .replace(DIACRITICOS, "");
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
