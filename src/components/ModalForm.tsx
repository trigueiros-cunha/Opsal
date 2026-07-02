"use client";

// ── Modal de formulário ───────────────────────────────────────────────────────
// Um botão abre um modal central (portal em document.body, para não ser cortado
// pelo overflow das tabelas/cartões). Fecha:
//   • ao submeter com sucesso (a server action não recarrega a página);
//   • ao clicar no fundo escurecido;
//   • com a tecla Esc;
//   • no botão ✕.
// Se a action lançar erro, o modal fica aberto para o utilizador corrigir.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalForm({
  label,
  title,
  action,
  children,
  buttonClassName,
  formClassName = "space-y-4",
  width = "max-w-lg",
}: {
  /** Conteúdo do botão que abre o modal. */
  label: ReactNode;
  /** Título mostrado no topo do modal. */
  title: string;
  /** Server action do formulário. O modal fecha quando corre sem erro. */
  action: (formData: FormData) => Promise<void>;
  /** Campos do formulário + botão de submit. */
  children: ReactNode;
  buttonClassName?: string;
  formClassName?: string;
  /** Largura máxima do modal (classe Tailwind). */
  width?: string;
}) {
  const [aberto, setAberto] = useState(false);

  // Esc fecha; bloquear scroll do body enquanto o modal está aberto.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", onKey);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto(true)}
      >
        {label}
      </button>

      {aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[10vh]"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // Fecha só quando o clique começa no próprio fundo (não ao arrastar
            // de dentro do painel para fora).
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAberto(false);
            }}
          >
            <div className={`card w-full ${width} p-5 shadow-xl`}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <form
                className={formClassName}
                action={async (formData) => {
                  await action(formData);
                  setAberto(false);
                }}
              >
                {children}
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
