import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extrairTituloPrioridade } from "@/lib/import/extrairTitulo";

describe("extrairTituloPrioridade (fallback sem chave)", () => {
  const antes = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (antes !== undefined) process.env.ANTHROPIC_API_KEY = antes;
  });

  it("sem chave usa heurística", async () => {
    const r = await extrairTituloPrioridade(
      "há uma fuga de água enorme na casa de banho",
    );
    expect(r.prioridade).toBe("alta");
    expect(r.titulo.length).toBeGreaterThan(0);
  });
});
