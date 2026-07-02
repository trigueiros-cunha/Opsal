import * as XLSX from "xlsx";
import type { LinhaCrua } from "./tipos";

function normNome(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Escolhe a folha "tabela de manutenções" (ignora "arquivo" e outras).
 * Se o ficheiro só tiver uma folha, usa-a. Se houver várias e nenhuma de
 * manutenções, devolve null (o chamador lança erro claro).
 */
function escolherFolha(nomes: string[]): string | null {
  if (nomes.length === 0) return null;
  const norm = nomes.map((nome) => ({ nome, n: normNome(nome) }));
  const exato = norm.find((x) => x.n === "tabela de manutencoes");
  if (exato) return exato.nome;
  const parcial = norm.find((x) => x.n.includes("manuten"));
  if (parcial) return parcial.nome;
  if (nomes.length === 1) return nomes[0];
  return null;
}

/** Lê a folha de manutenções e devolve uma linha por registo (texto). */
export function parseFicheiro(dados: Uint8Array): LinhaCrua[] {
  const wb = XLSX.read(dados, { type: "array" });
  const nome = escolherFolha(wb.SheetNames);
  if (!nome) {
    throw new Error(
      `Não encontrei a folha "tabela de manutenções". ` +
        `Folhas no ficheiro: ${wb.SheetNames.join(", ")}.`,
    );
  }
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
