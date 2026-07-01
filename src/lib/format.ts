// ── Formatação PT-PT (secção 2 / fase 8) ─────────────────────────────────────

const EUR = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

/** €1.234,56 */
export function formatEuro(valor: number | null | undefined): string {
  return EUR.format(valor ?? 0);
}

const NUM = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNumero(n: number | null | undefined): string {
  return NUM.format(n ?? 0);
}

/** dd/MM/yyyy a partir de uma data ISO ou 'YYYY-MM-DD'. */
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** dd/MM/yyyy HH:mm */
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** 'YYYY-MM-DD' local (sem deslize de fuso). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Segunda-feira da semana que contém `d` (semana PT: seg→dom). */
export function inicioDaSemana(d: Date): Date {
  const copia = new Date(d);
  const dow = copia.getDay(); // 0=dom … 6=sáb
  const diffParaSegunda = (dow + 6) % 7; // dom→6, seg→0, ter→1…
  copia.setDate(copia.getDate() - diffParaSegunda);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function adicionarDias(d: Date, n: number): Date {
  const copia = new Date(d);
  copia.setDate(copia.getDate() + n);
  return copia;
}

/** Total de uma linha de custo. */
export function totalLinha(quantidade: number, valorUnitario: number): number {
  return Math.round(quantidade * valorUnitario * 100) / 100;
}
