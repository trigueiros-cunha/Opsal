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
});
