// Avatar por iniciais do técnico (secção 3: tecnicos.iniciais).
const CORES = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function corPara(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return CORES[Math.abs(h) % CORES.length];
}

export function Avatar({
  iniciais,
  titulo,
  size = "md",
}: {
  iniciais: string | null | undefined;
  titulo?: string;
  size?: "sm" | "md";
}) {
  const txt = (iniciais ?? "—").slice(0, 3).toUpperCase();
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  const cor = iniciais ? corPara(txt) : "bg-slate-300";
  return (
    <span
      title={titulo ?? txt}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full font-semibold text-white ${cor}`}
    >
      {txt}
    </span>
  );
}
