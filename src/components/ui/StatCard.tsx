import Link from "next/link";

export function StatCard({
  label,
  valor,
  hint,
  href,
  tom = "default",
}: {
  label: string;
  valor: number | string;
  hint?: string;
  href?: string;
  tom?: "default" | "alerta" | "aviso" | "ok";
}) {
  const tomClasse = {
    default: "text-slate-900",
    alerta: "text-red-600",
    aviso: "text-amber-600",
    ok: "text-emerald-600",
  }[tom];

  const conteudo = (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${tomClasse}`}>{valor}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:-translate-y-0.5">
        {conteudo}
      </Link>
    );
  }
  return conteudo;
}
