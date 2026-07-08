import { describe, it, expect } from "vitest";
import {
  maoDeObra,
  totalIncidencia,
  formatarTempo,
  custoHoraCarregado,
  plIncidencia,
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

  it("plIncidencia: receita - (tempo + deslocação + materiais)", () => {
    const pl = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: 14.85,
      deslocacaoValor: 5,
      custosMateriais: 10,
      precoProprietario: 40,
    });
    expect(pl.custoTempo).toBe(14.85);
    expect(pl.custoDeslocacao).toBe(5);
    expect(pl.custoMateriais).toBe(10);
    expect(pl.custoTotal).toBe(29.85);
    expect(pl.receita).toBe(40);
    expect(pl.rentabilidade).toBe(10.15);
  });

  it("plIncidencia: sem técnico → custo de tempo 0; sem preço → receita 0", () => {
    const pl = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: null,
      deslocacaoValor: null,
      custosMateriais: null,
      precoProprietario: null,
    });
    expect(pl.custoTempo).toBe(0);
    expect(pl.custoTotal).toBe(0);
    expect(pl.receita).toBe(0);
    expect(pl.rentabilidade).toBe(0);
  });

  it("plProjeto: orçamento - custos", () => {
    const pl = plProjeto({ custos: 120, orcamentoValor: 300 });
    expect(pl.custoTotal).toBe(120);
    expect(pl.receita).toBe(300);
    expect(pl.rentabilidade).toBe(180);
    expect(plProjeto({ custos: 50, orcamentoValor: null }).rentabilidade).toBe(-50);
  });

  it("resumoTecnicoDia: agrega, calcula ocupação e break-even", () => {
    const a = plIncidencia({
      tempoMinutos: 120,
      custoHoraCarregado: 15,
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 50,
    });
    const b = plIncidencia({
      tempoMinutos: 60,
      custoHoraCarregado: 15,
      deslocacaoValor: 0,
      custosMateriais: 0,
      precoProprietario: 20,
    });
    const r = resumoTecnicoDia(
      [
        { pl: a, tempoMinutos: 120 },
        { pl: b, tempoMinutos: 60 },
      ],
      { horasDiaPadrao: 8, custoHoraCarregado: 15 },
    );
    expect(r.nIntervencoes).toBe(2);
    expect(r.receita).toBe(70);
    expect(r.custoTotal).toBe(45); // 30 + 15
    expect(r.resultado).toBe(25);
    expect(r.minutosProdutivos).toBe(180);
    expect(r.custoFixoDia).toBe(120); // 8 * 15
    expect(r.ocupacaoPct).toBe(38); // 3h / 8h
    expect(r.breakEvenPct).toBe(58); // 70 / 120
  });

  it("resumoTecnicoDia: guards com 0 horas e lista vazia", () => {
    const r = resumoTecnicoDia([], { horasDiaPadrao: 0, custoHoraCarregado: 0 });
    expect(r.nIntervencoes).toBe(0);
    expect(r.receita).toBe(0);
    expect(r.ocupacaoPct).toBe(0);
    expect(r.breakEvenPct).toBe(0);
    expect(r.custoFixoDia).toBe(0);
  });
});
