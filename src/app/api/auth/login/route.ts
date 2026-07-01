import { NextResponse } from "next/server";
import {
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  criarTokenSessao,
  passwordCorreta,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let password = "";
  let next = "/";
  try {
    const body = (await req.json()) as { password?: string; next?: string };
    password = body.password ?? "";
    if (typeof body.next === "string" && body.next.startsWith("/")) {
      next = body.next;
    }
  } catch {
    return NextResponse.json({ erro: "Pedido inválido" }, { status: 400 });
  }

  if (!passwordCorreta(password)) {
    return NextResponse.json({ erro: "Password incorreta" }, { status: 401 });
  }

  const token = await criarTokenSessao();
  const res = NextResponse.json({ redirect: next });
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
  return res;
}
