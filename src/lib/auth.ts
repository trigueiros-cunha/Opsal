// ── Autenticação single-user (secção 2) ──────────────────────────────────────
// Uma password única (APP_PASSWORD). Após validação, emite-se um cookie de
// sessão httpOnly assinado por HMAC (SESSION_SECRET). Sem Supabase Auth.
//
// Usa Web Crypto (crypto.subtle) para funcionar tanto no runtime Node (route
// handlers / server actions) como no runtime Edge (middleware).

export const SESSION_COOKIE = "opsal_session";
const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 30; // 30 dias

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 8) {
    throw new Error(
      "SESSION_SECRET por configurar (mínimo 8 caracteres) em .env.local",
    );
  }
  return s;
}

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function assinar(payload: string): Promise<string> {
  const key = await importKey(getSecret());
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(sig);
}

/** Cria o valor do cookie de sessão: `<emitidoMs>.<assinatura>`. */
export async function criarTokenSessao(): Promise<string> {
  const emitido = String(Date.now());
  const sig = await assinar(emitido);
  return `${emitido}.${sig}`;
}

/** Valida o token; devolve true se a assinatura casa e não expirou. */
export async function validarTokenSessao(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const ponto = token.indexOf(".");
  if (ponto <= 0) return false;

  const emitido = token.slice(0, ponto);
  const sig = token.slice(ponto + 1);

  const emitidoMs = Number(emitido);
  if (!Number.isFinite(emitidoMs)) return false;

  // Expirado?
  if (Date.now() - emitidoMs > MAX_AGE_SEGUNDOS * 1000) return false;

  let esperado: string;
  try {
    esperado = await assinar(emitido);
  } catch {
    return false;
  }
  return tempoConstanteIgual(sig, esperado);
}

/** Compara a password submetida com APP_PASSWORD. */
export function passwordCorreta(submetida: string): boolean {
  const esperada = process.env.APP_PASSWORD ?? "";
  if (!esperada) return false;
  return tempoConstanteIgual(submetida, esperada);
}

/** Comparação em tempo (aproximadamente) constante. */
function tempoConstanteIgual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEGUNDOS,
  secure: process.env.NODE_ENV === "production",
};
