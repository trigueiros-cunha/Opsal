import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SetupNotice } from "@/components/SetupNotice";
import { supabaseConfigurado } from "@/lib/supabase/admin";
import { listApartamentos } from "@/lib/data/apartamentos";
import { REGIOES, REGIAO_LABEL } from "@/lib/constants";
import type { Apartamento, Regiao } from "@/lib/types";
import {
  alternarAtivoApartamento,
  atualizarApartamento,
  criarApartamento,
} from "./actions";

export const dynamic = "force-dynamic";

function LinhaEditar({ a }: { a: Apartamento }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-slate-500 hover:underline">
        Editar
      </summary>
      <form
        action={atualizarApartamento}
        className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3"
      >
        <input type="hidden" name="id" value={a.id} />
        <div>
          <label className="label">Código</label>
          <input name="codigo" defaultValue={a.codigo} className="input py-1" />
        </div>
        <div>
          <label className="label">Região</label>
          <select name="regiao" defaultValue={a.regiao} className="input py-1">
            {REGIOES.map((r) => (
              <option key={r} value={r}>
                {REGIAO_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Descrição</label>
          <input
            name="descricao"
            defaultValue={a.descricao ?? ""}
            className="input py-1"
          />
        </div>
        <div>
          <label className="label">Estado</label>
          <select
            name="ativo"
            defaultValue={a.ativo ? "true" : "false"}
            className="input py-1"
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>
        <div className="flex items-end justify-end">
          <button className="btn-primary px-3 py-1.5 text-xs">Guardar</button>
        </div>
      </form>
    </details>
  );
}

export default async function ApartamentosPage({
  searchParams,
}: {
  searchParams: { q?: string; regiao?: string; inativos?: string };
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Apartamentos" />
        <SetupNotice />
      </>
    );
  }

  const regiao = REGIOES.includes(searchParams.regiao as Regiao)
    ? (searchParams.regiao as Regiao)
    : undefined;
  const q = searchParams.q?.trim() || undefined;
  const incluirInativos = searchParams.inativos === "1";

  const apartamentos = await listApartamentos({ regiao, q, incluirInativos });

  // Agrupar por região.
  const porRegiao = new Map<Regiao, Apartamento[]>();
  for (const a of apartamentos) {
    const arr = porRegiao.get(a.regiao) ?? [];
    arr.push(a);
    porRegiao.set(a.regiao, arr);
  }

  return (
    <>
      <PageHeader
        titulo="Apartamentos"
        descricao={`${apartamentos.length} apartamentos · fonte de verdade para seletores e validação`}
        acao={
          <details className="group relative">
            <summary className="btn-primary cursor-pointer list-none">
              + Adicionar
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <form action={criarApartamento} className="space-y-3">
                <div>
                  <label className="label">Código *</label>
                  <input name="codigo" required className="input" placeholder="ACM021" />
                </div>
                <div>
                  <label className="label">Região *</label>
                  <select name="regiao" required className="input">
                    {REGIOES.map((r) => (
                      <option key={r} value={r}>
                        {REGIAO_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Descrição</label>
                  <input name="descricao" className="input" />
                </div>
                <div className="flex justify-end">
                  <button className="btn-primary">Adicionar</button>
                </div>
              </form>
            </div>
          </details>
        }
      />

      {/* Procura + filtros */}
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="grow">
          <label className="label">Procurar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            className="input"
            placeholder="Código ou descrição…"
          />
        </div>
        <div>
          <label className="label">Região</label>
          <select name="regiao" defaultValue={regiao ?? ""} className="input min-w-[9rem]">
            <option value="">Todas</option>
            {REGIOES.map((r) => (
              <option key={r} value={r}>
                {REGIAO_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs text-slate-600">
          <input
            type="checkbox"
            name="inativos"
            value="1"
            defaultChecked={incluirInativos}
          />
          Incluir inativos
        </label>
        <button className="btn-secondary">Procurar</button>
      </form>

      {apartamentos.length === 0 ? (
        <EmptyState titulo="Sem resultados" descricao="Ajusta a procura ou os filtros." />
      ) : (
        <div className="space-y-6">
          {REGIOES.filter((r) => porRegiao.has(r)).map((r) => (
            <div key={r}>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">
                {REGIAO_LABEL[r]}{" "}
                <span className="font-normal text-slate-400">
                  ({porRegiao.get(r)!.length})
                </span>
              </h2>
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="th w-28">Código</th>
                      <th className="th">Descrição</th>
                      <th className="th w-20">Estado</th>
                      <th className="th w-40 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porRegiao.get(r)!.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="td font-mono text-xs font-semibold">
                          {a.codigo}
                        </td>
                        <td className="td text-slate-600">{a.descricao ?? "—"}</td>
                        <td className="td">
                          {a.ativo ? (
                            <span className="badge border-green-200 bg-green-50 text-green-700">
                              Ativo
                            </span>
                          ) : (
                            <span className="badge border-slate-200 bg-slate-100 text-slate-500">
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-3">
                            <LinhaEditar a={a} />
                            <form action={alternarAtivoApartamento}>
                              <input type="hidden" name="id" value={a.id} />
                              <input
                                type="hidden"
                                name="ativo"
                                value={String(a.ativo)}
                              />
                              <button className="text-xs text-slate-400 hover:underline">
                                {a.ativo ? "Desativar" : "Reativar"}
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
