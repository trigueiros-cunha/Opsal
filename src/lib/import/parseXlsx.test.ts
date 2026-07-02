import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFicheiro } from "@/lib/import/parseXlsx";

function livro(folhas: Record<string, string[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(folhas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(buf);
}

const CAB = ["DATA", "CASA", "PROBLEMA", "RESOLVIDO"];

describe("parseFicheiro", () => {
  it("lê linhas por cabeçalho e faz trim", () => {
    const bytes = livro({
      Folha1: [CAB, ["02/07/2026", " ALMAD2 ", "porta partida", "Não"]],
    });
    const linhas = parseFicheiro(bytes);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["CASA"]).toBe("ALMAD2");
    expect(linhas[0]["PROBLEMA"]).toBe("porta partida");
  });

  it("escolhe a folha de manutenções e ignora a 'arquivo'", () => {
    const bytes = livro({
      arquivo: [CAB, ["01/01/2020", "ZZZ99", "linha do arquivo", "Sim"]],
      "Tabela de Manutenções": [
        CAB,
        ["02/07/2026", "ALMAD2", "problema certo", "Não"],
      ],
    });
    const linhas = parseFicheiro(bytes);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["PROBLEMA"]).toBe("problema certo");
  });

  it("ficheiro de folha única sem match usa essa folha", () => {
    const bytes = livro({ QualquerNome: [CAB] });
    expect(parseFicheiro(bytes)).toHaveLength(0);
  });

  it("várias folhas sem nenhuma de manutenções → erro claro", () => {
    const bytes = livro({ arquivo: [CAB], notas: [CAB] });
    expect(() => parseFicheiro(bytes)).toThrow(/tabela de manuten/i);
  });
});
