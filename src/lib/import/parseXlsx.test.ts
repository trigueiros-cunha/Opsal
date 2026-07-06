import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFicheiro } from "@/lib/import/parseXlsx";
import { dataParaIso } from "@/lib/import/chave";

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

  it("salta linhas de título por cima dos cabeçalhos", () => {
    const bytes = livro({
      Folha1: [
        ["Tabela de Manutenções — Julho", "", "", ""],
        ["", "", "", ""],
        CAB,
        ["02/07/2026", "ALMAD2", "problema certo", "Não"],
      ],
    });
    const linhas = parseFicheiro(bytes);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]["PROBLEMA"]).toBe("problema certo");
    expect(linhas[0]["CASA"]).toBe("ALMAD2");
  });

  it("ignora linhas totalmente vazias entre os dados", () => {
    const bytes = livro({
      Folha1: [
        CAB,
        ["02/07/2026", "ALMAD2", "um", "Não"],
        ["", "", "", ""],
        ["03/07/2026", "ALMAD2", "dois", "Sim"],
      ],
    });
    expect(parseFicheiro(bytes)).toHaveLength(2);
  });

  it("lê datas do Excel como série e dataParaIso converte para ISO", () => {
    // 46205 = número de série do Excel para 2026-07-02.
    const ws = XLSX.utils.aoa_to_sheet([CAB, [46205, "ALMAD2", "x", "Não"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folha1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const linhas = parseFicheiro(new Uint8Array(buf));
    expect(linhas).toHaveLength(1);
    expect(dataParaIso(linhas[0]["DATA"])).toBe("2026-07-02");
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

  it("várias folhas sem nenhuma de manutenções → erro claro", () => {
    const bytes = livro({ arquivo: [["x"]], notas: [["y"]] });
    expect(() => parseFicheiro(bytes)).toThrow(/tabela de manuten/i);
  });

  it("folha única sem cabeçalhos reconhecíveis → erro claro", () => {
    const bytes = livro({ Folha1: [["ola", "mundo"], ["1", "2"]] });
    expect(() => parseFicheiro(bytes)).toThrow(/cabeçalho/i);
  });
});
