import { describe, it, expect } from "vitest";
import { prioridadePorPalavrasChave, tituloCurto } from "@/lib/import/heuristicas";

describe("heuristicas", () => {
  it("deteta prioridade alta", () => {
    expect(prioridadePorPalavrasChave("há uma fuga de água na cozinha")).toBe("alta");
    expect(prioridadePorPalavrasChave("apartamento sem luz")).toBe("alta");
  });

  it("deteta prioridade baixa", () => {
    expect(prioridadePorPalavrasChave("trocar a lâmpada fundida")).toBe("baixa");
  });

  it("default média", () => {
    expect(prioridadePorPalavrasChave("a máquina da loiça não funciona")).toBe("media");
  });

  it("título curto limita palavras e nunca vem vazio", () => {
    expect(tituloCurto("a porta principal não fecha bem de todo mesmo", 4)).toBe(
      "a porta principal não",
    );
    expect(tituloCurto("   ")).toBe("Incidência");
  });
});
