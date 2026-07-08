"use client";

import { useRouter } from "next/navigation";

export function SeletorData({ data }: { data: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      className="input w-auto"
      value={data}
      onChange={(e) => router.push(`/rentabilidade?data=${e.target.value}`)}
    />
  );
}
