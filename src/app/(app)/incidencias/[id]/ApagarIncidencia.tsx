"use client";

import { ModalForm } from "@/components/ModalForm";
import { apagarIncidencia } from "../actions";

export function ApagarIncidencia({ id }: { id: string }) {
  return (
    <div className="card border-red-200 p-4">
      <p className="text-xs font-semibold text-red-700">Zona de perigo</p>
      <p className="mb-3 mt-1 text-xs text-slate-500">
        Apagar remove a incidência, os custos e as fotos. Não há como voltar atrás.
      </p>
      <ModalForm
        label="Apagar incidência"
        title="Apagar incidência?"
        action={apagarIncidencia}
        buttonClassName="btn-danger"
      >
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-slate-600">
          Isto apaga <strong>permanentemente</strong> esta incidência, com os
          respetivos custos e fotos. Não é possível desfazer.
        </p>
        <div className="flex justify-end">
          <button type="submit" className="btn-danger">
            Apagar definitivamente
          </button>
        </div>
      </ModalForm>
    </div>
  );
}
