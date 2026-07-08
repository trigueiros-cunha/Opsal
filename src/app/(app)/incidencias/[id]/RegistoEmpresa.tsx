"use client";

import { useState } from "react";
import type { Registo } from "@/lib/registo";

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Seccao({ titulo, texto }: { titulo: string; texto: string }) {
  const [estado, setEstado] = useState<"" | "ok" | "erro">("");
  const vazio = !texto.trim();
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">{titulo}</p>
        <button
          type="button"
          disabled={vazio}
          className="btn-secondary px-2 py-1 text-xs"
          onClick={async () => {
            const ok = await copiar(texto);
            setEstado(ok ? "ok" : "erro");
            setTimeout(() => setEstado(""), 1500);
          }}
        >
          {estado === "ok"
            ? "Copiado ✓"
            : estado === "erro"
              ? "Copia à mão"
              : "Copiar"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words text-xs text-slate-600">
        {vazio ? "—" : texto}
      </pre>
    </div>
  );
}

export function RegistoEmpresa({ registo }: { registo: Registo }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Registo para a empresa
        </h3>
        <button
          type="button"
          className="btn-primary px-2 py-1 text-xs"
          onClick={() => copiar(registo.tudo)}
        >
          Copiar tudo
        </button>
      </div>
      <div className="space-y-2">
        <Seccao titulo="Como foi resolvido" texto={registo.resolucao} />
        <Seccao titulo="Faturas e custos (sem IVA)" texto={registo.custos} />
        <Seccao titulo="Outros custos (sem fatura)" texto={registo.outros} />
        <Seccao titulo="Custo estimado" texto={registo.total} />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Bate certo com os 4 campos do &quot;Maintenance resolution&quot;. Valores sem IVA.
      </p>
    </div>
  );
}
