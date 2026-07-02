import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFicheiro } from "@/lib/import/parseXlsx";

function ficheiro(linhas: string[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Folha1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(buf);
}

describe("parseFicheiro", () => {
  it("lê linhas por cabeçalho e faz trim", () => {
    const bytes = ficheiro([
      ["DATA", "CASA", "PROBLEMA", "RESOLVIDO"],
      ["02/07/2026", " ALMAD2 ", "porta partida", "Não"],
    ]);
    const linhas = parseFicheiro(bytes);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["CASA"]).toBe("ALMAD2");
    expect(linhas[0]["PROBLEMA"]).toBe("porta partida");
  });

  it("ficheiro sem linhas de dados → array vazio", () => {
    expect(parseFicheiro(ficheiro([["DATA", "CASA"]]))).toHaveLength(0);
  });
});
