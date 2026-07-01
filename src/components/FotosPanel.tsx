"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FotoComUrl } from "@/lib/data/fotos";

type ActionFn = (fd: FormData) => Promise<void>;

export function FotosPanel({
  parentField,
  parentId,
  fotos,
  onUpload,
  onRemove,
}: {
  parentField: "incidencia_id" | "projeto_id";
  parentId: string;
  fotos: FotoComUrl[];
  onUpload: ActionFn;
  onRemove: ActionFn;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(file: File) {
    const fd = new FormData();
    fd.set(parentField, parentId);
    fd.set("file", file);
    setErro(null);
    startTransition(async () => {
      try {
        await onUpload(fd);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha no upload");
      }
    });
  }

  function remover(foto: FotoComUrl) {
    const fd = new FormData();
    fd.set("id", foto.id);
    fd.set(parentField, parentId);
    fd.set("storage_path", foto.storage_path);
    startTransition(async () => {
      await onRemove(fd);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Fotos</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          {pending ? "A carregar…" : "+ Adicionar foto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
            e.target.value = "";
          }}
        />
      </div>

      {erro ? <p className="mb-2 text-xs text-red-600">{erro}</p> : null}

      {fotos.length === 0 ? (
        <p className="text-xs text-slate-400">Sem fotos.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f) => (
            <div
              key={f.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.url}
                  alt="foto"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                  sem preview
                </div>
              )}
              <button
                type="button"
                onClick={() => remover(f)}
                className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
