import { NextResponse } from "next/server";
import { temSessao } from "@/lib/session";
import { eventosDaSemana } from "@/lib/data/agenda";
import { inicioDaSemana, toISODate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await temSessao())) {
    return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const inicioParam = searchParams.get("inicio");

  // Normaliza para a segunda-feira da semana pedida (ou a atual).
  const base = inicioParam ? new Date(inicioParam + "T00:00:00") : new Date();
  const segunda = inicioDaSemana(
    Number.isNaN(base.getTime()) ? new Date() : base,
  );
  const inicioISO = toISODate(segunda);

  try {
    const eventos = await eventosDaSemana(inicioISO);
    return NextResponse.json({ inicio: inicioISO, eventos });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro na agenda" },
      { status: 500 },
    );
  }
}
