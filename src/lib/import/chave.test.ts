import { describe, it, expect } from "vitest";
import {
  normalizarCasa,
  normalizarProblema,
  dataParaIso,
  calcularImportRef,
} from "@/lib/import/chave";

describe("chave", () => {
  it("normaliza casa (trim + upper)", () => {
    expect(normalizarCasa("  almad2 ")).toBe("ALMAD2");
  });

  it("normaliza problema (trim + espaços colapsados)", () => {
    expect(normalizarProblema("  a   porta   partida ")).toBe("a porta partida");
  });

  it("converte data DD/MM/YYYY para ISO", () => {
    expect(dataParaIso("02/07/2026")).toBe("2026-07-02");
    expect(dataParaIso("2/7/2026")).toBe("2026-07-02");
  });

  it("rejeita datas inválidas", () => {
    expect(dataParaIso("31/02/2026")).toBeNull();
    expect(dataParaIso("2026-07-02")).toBeNull();
    expect(dataParaIso("")).toBeNull();
  });

  it("import_ref é estável e sensível ao conteúdo", () => {
    const a = calcularImportRef("ALMAD2", "2026-07-02", "porta partida");
    const b = calcularImportRef(" almad2 ", "2026-07-02", "porta   partida");
    const c = calcularImportRef("ALMAD2", "2026-07-02", "outra coisa");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
