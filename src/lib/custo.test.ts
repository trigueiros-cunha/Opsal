import { describe, it, expect } from "vitest";
import {
  maoDeObra,
  totalIncidencia,
  formatarTempo,
  custoHoraCarregado,
  contribuicaoIncidencia,
  plProjeto,
  resumoTecnicoDia,
} from "@/lib/custo";

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

describe("rentabilidade", () => {
  it("custoHoraCarregado aplica encargos sobre o base", () => {
    expect(custoHoraCarregado(12, 23.75)).toBe(14.85);
    expect(custoHoraCarregado(12, 0)).toBe(12);
    expect(custoHoraCarregado(null, 23.75)).toBe(0);
    expect(custoHoraCarregado(10, null)).toBe(10);
  });

  it("contribuicaoIncidencia = receita − deslocação − materiais", () => {
    const c = contribuicaoIncidencia({
      deslocacaoValor: 5,
      custosMateriais: 10,
      precoProprietario: 40,
    });
    expect(c.receita).toBe(40);
    expect(c.custoDeslocacao).toBe(5);
    expect(c.custoMateriais).toBe(10);
    expect(c.contribuicao).toBe(25);
  });

  it("contribuicaoIncidencia: sem preço → receita 0; contribuição pode ficar negativa", () => {
    const c = contribuicaoIncidencia({
      deslocacaoValor: 8,
      custosMateriais: null,
      precoProprietario: null,
    });
    expect(c.receita).toBe(0);
    expect(c.contribuicao).toBe(-8); // o serviço não cobre a deslocação
  });

  it("plProjeto: orçamento − custos", () => {
    const pl = plProjeto({ custos: 120, orcamentoValor: 300 });
    expect(pl.custoTotal).toBe(120);
    expect(pl.receita).toBe(300);
    expect(pl.rentabilidade).toBe(180);
    expect(plProjeto({ custos: 50, orcamentoValor: null }).rentabilidade).toBe(-50);
  });

  it("resumoTecnicoDia: resultado = Σ contribuição − custo do dia", () => {
    const a = contribuicaoIncidencia({
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 50,
    });
    const b = contribuicaoIncidencia({
      deslocacaoValor: 5,
      custosMateriais: 0,
      precoProprietario: 20,
    });
    const r = resumoTecnicoDia(
      [
        { contrib: a, tempoMinutos: 120 },
        { contrib: b, tempoMinutos: 60 },
      ],
      { horasDiaPadrao: 8, custoHoraCarregado: 15 },
    );
    expect(r.nIntervencoes).toBe(2);
    expect(r.receita).toBe(70);
    expect(r.deslocacoes).toBe(5);
    expect(r.materiais).toBe(0);
    expect(r.contribuicao).toBe(65); // 50 + 15
    expect(r.custoDia).toBe(120); // 8 × 15
    expect(r.resultado).toBe(-55); // 65 − 120
    expect(r.minutosProdutivos).toBe(180);
    expect(r.ocupacaoPct).toBe(38); // 3h / 8h
    expect(r.breakEvenPct).toBe(54); // 65/120 → 54
  });

  it("resumoTecnicoDia: guards com 0 horas e lista vazia", () => {
    const r = resumoTecnicoDia([], { horasDiaPadrao: 0, custoHoraCarregado: 0 });
    expect(r.nIntervencoes).toBe(0);
    expect(r.receita).toBe(0);
    expect(r.contribuicao).toBe(0);
    expect(r.resultado).toBe(0);
    expect(r.ocupacaoPct).toBe(0);
    expect(r.breakEvenPct).toBe(0);
    expect(r.custoDia).toBe(0);
  });
});
