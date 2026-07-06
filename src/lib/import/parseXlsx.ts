import * as XLSX from "xlsx";
import type { LinhaCrua } from "./tipos";

function normNome(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Converte uma célula (texto, número ou Data do Excel) em texto. Datas → ISO. */
function celParaTexto(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  return String(v).trim();
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

/** Índice da linha de cabeçalhos (contém PROBLEMA, ou CASA+DATA). -1 se não houver. */
function encontrarCabecalho(matriz: unknown[][]): number {
  const limite = Math.min(matriz.length, 30);
  for (let i = 0; i < limite; i++) {
    const cells = (matriz[i] ?? []).map((c) => normNome(String(c ?? "")));
    const temProblema = cells.includes("problema");
    const temCasaData = cells.includes("casa") && cells.includes("data");
    if (temProblema || temCasaData) return i;
  }
  return -1;
}

/**
 * Lê a folha de manutenções e devolve uma linha por registo (valores em texto).
 * Deteta a linha de cabeçalhos (salta título/banner por cima) e lê as datas
 * como datas reais (cellDates), convertendo-as para ISO.
 */
export function parseFicheiro(dados: Uint8Array): LinhaCrua[] {
  // Sem cellDates: as datas ficam como número de série do Excel, que o
  // dataParaIso converte com matemática UTC (à prova de fusos horários).
  const wb = XLSX.read(dados, { type: "array" });
  const nome = escolherFolha(wb.SheetNames);
  if (!nome) {
    throw new Error(
      `Não encontrei a folha "tabela de manutenções". ` +
        `Folhas no ficheiro: ${wb.SheetNames.join(", ")}.`,
    );
  }

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  const idxCab = encontrarCabecalho(matriz);
  if (idxCab < 0) {
    throw new Error(
      `Não encontrei a linha de cabeçalho (DATA/CASA/PROBLEMA) na folha "${nome}".`,
    );
  }

  const cabecalhos = (matriz[idxCab] ?? []).map((c) => String(c ?? "").trim());

  const linhas: LinhaCrua[] = [];
  for (let r = idxCab + 1; r < matriz.length; r++) {
    const bruta = matriz[r] ?? [];
    const out: LinhaCrua = {};
    let temAlgum = false;
    cabecalhos.forEach((h, c) => {
      if (!h) return;
      const v = celParaTexto(bruta[c]);
      out[h] = v;
      if (v) temAlgum = true;
    });
    if (temAlgum) linhas.push(out);
  }
  return linhas;
}
