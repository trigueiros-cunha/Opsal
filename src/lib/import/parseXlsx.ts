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
