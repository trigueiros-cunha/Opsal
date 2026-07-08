import { describe, it, expect } from "vitest";
import { construirRegisto } from "@/lib/registo";

const base = {
  notasResolucao: "Trocado o canhão da fechadura",
  tempoMinutos: 90,
  deslocacaoModo: "carrinha",
  deslocacaoValor: 20,
  custos: [{ descricao: "Canhão", quantidade: 1, valor_unitario: 15 }],
  tecnico: { nome: "Guilherme Cunha", iniciais: "GC", custo_hora: 20 },
};

describe("construirRegisto", () => {
  it("caso completo (com técnico)", () => {
    const r = construirRegisto(base);
    expect(r.resolucao).toBe("Trocado o canhão da fechadura");
    expect(r.custos).toContain("Canhão");
    expect(r.custos).toContain("15,00€");
    expect(r.outros).toContain("Deslocação em carrinha");
    expect(r.outros).toContain("GC dedicou 1h30 no local");
    expect(r.total).toBe("65.00"); // 15 + 30 + 20
    expect(r.tudo).toContain("Custo estimado: 65.00");
  });

  it("sem técnico: tempo sem valor e frase genérica", () => {
    const r = construirRegisto({ ...base, tecnico: null });
    expect(r.outros).toContain("Trabalho no local: 1h30");
    expect(r.total).toBe("35.00"); // 15 + 0 + 20
  });

  it("sem deslocação nem tempo: outros vazio", () => {
    const r = construirRegisto({
      ...base,
      tempoMinutos: null,
      deslocacaoModo: null,
      deslocacaoValor: null,
    });
    expect(r.outros).toBe("");
  });

  it("sem custos: lista vazia", () => {
    const r = construirRegisto({ ...base, custos: [] });
    expect(r.custos).toBe("");
  });
});
