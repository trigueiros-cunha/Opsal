import { describe, it, expect } from "vitest";
import { totalEncomenda } from "@/lib/encomenda";

describe("encomenda", () => {
  it("soma quantidade × valor_unitario das linhas, a 2 casas", () => {
    expect(
      totalEncomenda([
        { quantidade: 3, valor_unitario: 12.19 },
        { quantidade: 1, valor_unitario: 5 },
      ]),
    ).toBe(41.57);
  });

  it("lista vazia = 0", () => {
    expect(totalEncomenda([])).toBe(0);
  });

  it("arredonda por linha antes de somar (consistente com o editor)", () => {
    expect(
      totalEncomenda([
        { quantidade: 2.5, valor_unitario: 1.11 },
        { quantidade: 2.5, valor_unitario: 1.11 },
      ]),
    ).toBe(5.56);
  });
});
