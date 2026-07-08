"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSessao } from "@/lib/session";
import { updateConfig } from "@/lib/data/config";

function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function guardarConfig(formData: FormData) {
  await exigirSessao();
  await updateConfig({
    taxa_encargos_pct: num(formData.get("taxa_encargos_pct")),
    horas_dia_padrao: num(formData.get("horas_dia_padrao")),
  });
  revalidatePath("/rentabilidade");
  revalidatePath("/rentabilidade/config");
  redirect("/rentabilidade");
}
