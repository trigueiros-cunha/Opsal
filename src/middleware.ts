import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, validarTokenSessao } from "@/lib/auth";

// Protege todas as rotas exceto /login e a rota de auth. (secção 2)
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const autenticado = await validarTokenSessao(token);

  const emLogin = pathname === "/login";

  if (!autenticado && !emLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Já autenticado a tentar ver /login → manda para Hoje.
  if (autenticado && emLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclui assets estáticos, a API de auth (precisa de correr sem sessão) e ficheiros.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
