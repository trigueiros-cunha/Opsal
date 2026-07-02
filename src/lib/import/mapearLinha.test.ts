import { describe, it, expect } from "vitest";
import { mapearLinha } from "@/lib/import/mapearLinha";
import type { MapaApartamentos } from "@/lib/import/tipos";

const apts: MapaApartamentos = new Map([
  ["ALMAD2", { id: "id-almad2", regiao: "lisboa" }],
]);

function crua(over: Record<string, string> = {}): Record<string, string> {
  return {
    DATA: "02/07/2026",
    CASA: "ALMAD2",
    Cidade: "Lisboa",
    PROBLEMA: "a máquina da loiça não funciona",
    "RESP.": "HM",
    "Link para fotos/docs": "",
    "OBSERVAÇÕES FO": "",
    "OBSERVAÇÕES HM": "",
    "OBSERVAÇÕES HSK": "",
    RESOLVIDO: "Não",
    ...over,
  };
}

describe("mapearLinha", () => {
  it("mapeia uma linha válida (aberta)", () => {
    const r = mapearLinha(crua(), 2, apts);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.campos.apartamento_id).toBe("id-almad2");
    expect(r.campos.estado).toBe("aberta");
    expect(r.campos.resolvida_em).toBeNull();
    expect(r.campos.aberta_em).toBe("2026-07-02");
    expect(r.campos.descricao).toContain("a máquina da loiça");
    expect(r.campos.import_ref).toMatch(/^[0-9a-f]{64}$/);
  });

  it("RESOLVIDO=Sim → resolvida com resolvida_em", () => {
    const r = mapearLinha(crua({ RESOLVIDO: "Sim" }), 2, apts);
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.campos.estado).toBe("resolvida");
    expect(r.campos.resolvida_em).toBe("2026-07-02");
  });

  it("anexa observações e resp à descrição", () => {
    const r = mapearLinha(
      crua({ "OBSERVAÇÕES FO": "falar com hóspede", "RESP.": "HM" }),
      2,
      apts,
    );
    if (r.status !== "ok") throw new Error("esperava ok");
    expect(r.campos.descricao).toContain("Obs. FO: falar com hóspede");
    expect(r.campos.descricao).toContain("Resp.: HM");
  });

  it("apartamento desconhecido → erro", () => {
    const r = mapearLinha(crua({ CASA: "ACMx" }), 5, apts);
    expect(r.status).toBe("erro");
    if (r.status !== "erro") return;
    expect(r.motivo).toContain("ACMx");
  });

  it("data inválida → erro; problema vazio → erro", () => {
    expect(mapearLinha(crua({ DATA: "xx" }), 2, apts).status).toBe("erro");
    expect(mapearLinha(crua({ PROBLEMA: "  " }), 2, apts).status).toBe("erro");
  });
});
