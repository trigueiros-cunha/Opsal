import { uploadFatura, removerFatura } from "../actions";

export function FaturaPanel({
  encomendaId,
  url,
}: {
  encomendaId: string;
  url: string | null;
}) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Fatura</h3>

      {url ? (
        <div className="mb-3 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            📄 Ver fatura
          </a>
          <form action={removerFatura}>
            <input type="hidden" name="encomenda_id" value={encomendaId} />
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Remover
            </button>
          </form>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-500">Sem fatura anexada.</p>
      )}

      <form action={uploadFatura} className="space-y-2">
        <input type="hidden" name="encomenda_id" value={encomendaId} />
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
        />
        <button type="submit" className="btn-secondary w-full text-xs">
          Carregar fatura
        </button>
      </form>
    </div>
  );
}
