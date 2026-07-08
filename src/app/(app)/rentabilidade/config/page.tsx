import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/data/config";
import { guardarConfig } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Configuração" />
        <SetupNotice />
      </>
    );
  }

  const cfg = await getConfig();

  return (
    <>
      <PageHeader
        titulo="Configuração — Rentabilidade"
        descricao="Encargos e dia de trabalho padrão para o cálculo do break-even."
        acao={
          <Link href="/rentabilidade" className="btn-secondary">
            ← Voltar
          </Link>
        }
      />

      <form action={guardarConfig} className="card max-w-md space-y-4 p-5">
        <div>
          <label className="label" htmlFor="taxa_encargos_pct">
            Taxa de encargos (%)
          </label>
          <input
            id="taxa_encargos_pct"
            name="taxa_encargos_pct"
            type="number"
            step="0.01"
            className="input"
            defaultValue={cfg.taxa_encargos_pct}
          />
          <p className="mt-1 text-xs text-slate-400">
            TSU + seguro sobre o custo/hora base do técnico (ex.: 23,75).
          </p>
        </div>

        <div>
          <label className="label" htmlFor="horas_dia_padrao">
            Horas por dia (break-even)
          </label>
          <input
            id="horas_dia_padrao"
            name="horas_dia_padrao"
            type="number"
            step="0.5"
            className="input"
            defaultValue={cfg.horas_dia_padrao}
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </>
  );
}
