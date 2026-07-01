import { NextResponse } from "next/server";
import { temSessao } from "@/lib/session";
import { extrairIncidencia } from "@/lib/extrair";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await temSessao())) {
    return NextResponse.json({ erro: "Sem sessão" }, { status: 401 });
  }

  let texto = "";
  try {
    const body = (await req.json()) as { texto?: string };
    texto = (body.texto ?? "").trim();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido" }, { status: 400 });
  }

  if (!texto) {
    return NextResponse.json({ erro: "Texto vazio" }, { status: 400 });
  }

  try {
    const resultado = await extrairIncidencia(texto);
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro na extração" },
      { status: 500 },
    );
  }
}
