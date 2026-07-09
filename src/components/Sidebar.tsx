"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Hoje", icon: "◎" },
  { href: "/agenda", label: "Agenda", icon: "▦" },
  { href: "/incidencias", label: "Incidências", icon: "▲" },
  { href: "/recorrentes", label: "Recorrentes", icon: "↻" },
  { href: "/projetos", label: "Projetos", icon: "◆" },
  { href: "/encomendas", label: "Encomendas", icon: "📦" },
  { href: "/rentabilidade", label: "Rentabilidade", icon: "€" },
  { href: "/tecnicos", label: "Técnicos", icon: "☺" },
  { href: "/apartamentos", label: "Apartamentos", icon: "⌂" },
];

export function Sidebar() {
  const pathname = usePathname();

  function ativo(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            OP
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">OPSAL</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Manutenções AL
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              ativo(l.href)
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="w-4 text-center opacity-80">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            ⎋ Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
