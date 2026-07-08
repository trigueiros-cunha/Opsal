import { describe, it, expect } from "vitest";
import { maoDeObra, totalIncidencia, formatarTempo } from "@/lib/custo";

describe("custo", () => {
  it("maoDeObra = tempo/60 * custoHora; null sem técnico ou sem tempo", () => {
    expect(maoDeObra(90, 20)).toBe(30);
    expect(maoDeObra(90, null)).toBeNull();
    expect(maoDeObra(0, 20)).toBeNull();
    expect(maoDeObra(null, 20)).toBeNull();
    expect(maoDeObra(30, 20)).toBe(10);
  });

  it("totalIncidencia soma custos + mão de obra + deslocação", () => {
    expect(totalIncidencia({ custos: 10, maoDeObra: 30, deslocacaoValor: 5 })).toBe(45);
    expect(totalIncidencia({ custos: 10, maoDeObra: null, deslocacaoValor: null })).toBe(10);
  });

  it("formatarTempo", () => {
    expect(formatarTempo(90)).toBe("1h30");
    expect(formatarTempo(60)).toBe("1h");
    expect(formatarTempo(45)).toBe("45min");
    expect(formatarTempo(0)).toBe("");
    expect(formatarTempo(null)).toBe("");
  });
});
