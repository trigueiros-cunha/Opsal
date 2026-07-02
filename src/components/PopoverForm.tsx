"use client";

// ── Painel de formulário que fecha ao submeter ────────────────────────────────
// Substitui o padrão nativo <details>/<summary>: esse mantém o estado aberto no
// DOM e, como as server actions não recarregam a página, o painel ficava aberto
// depois de "Criar"/"Guardar". Aqui o estado é do React e fecha-se quando a
// action corre com sucesso (se lançar erro, fica aberto para o utilizador corrigir).

import { useState, type ReactNode } from "react";

export function PopoverForm({
  label,
  action,
  children,
  className,
  buttonClassName,
  formClassName,
  panelClassName,
  floating = true,
  align = "right",
}: {
  /** Conteúdo do botão que abre/fecha o painel. */
  label: ReactNode;
  /** Server action do formulário. O painel fecha quando corre sem erro. */
  action: (formData: FormData) => Promise<void>;
  /** Campos do formulário + botão de submit. */
  children: ReactNode;
  /** Classe do contentor exterior (ex.: "flex-1"). */
  className?: string;
  /** Classe do botão que alterna o painel. */
  buttonClassName?: string;
  /** Classe do <form>. */
  formClassName?: string;
  /** Classe extra do painel flutuante (ex.: largura "w-96"). */
  panelClassName?: string;
  /** true: painel flutuante (absolute). false: em fluxo, por baixo do botão. */
  floating?: boolean;
  align?: "left" | "right";
}) {
  const [aberto, setAberto] = useState(false);

  const form = (
    <form
      className={formClassName}
      action={async (formData) => {
        await action(formData);
        setAberto(false);
      }}
    >
      {children}
    </form>
  );

  const wrapper = [floating ? "relative" : "", className ?? ""].join(" ").trim();

  return (
    <div className={wrapper || undefined}>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {label}
      </button>

      {aberto &&
        (floating ? (
          <div
            className={`absolute ${
              align === "right" ? "right-0" : "left-0"
            } z-10 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg ${
              panelClassName ?? ""
            }`}
          >
            {form}
          </div>
        ) : (
          form
        ))}
    </div>
  );
}
