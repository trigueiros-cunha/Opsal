import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, validarTokenSessao } from "./auth";

/** true se o pedido atual tem sessão válida (para server components/actions). */
export async function temSessao(): Promise<boolean> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return validarTokenSessao(token);
}

/** Lança se não houver sessão. Usar no topo de cada server action. */
export async function exigirSessao(): Promise<void> {
  if (!(await temSessao())) {
    throw new Error("Sessão inválida. Volta a entrar.");
  }
}
