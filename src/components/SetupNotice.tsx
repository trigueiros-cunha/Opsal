export function SetupNotice() {
  return (
    <div className="card border-amber-200 bg-amber-50 p-6">
      <p className="text-sm font-semibold text-amber-900">
        Supabase por configurar
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Define <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        e{" "}
        <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        em <code className="rounded bg-amber-100 px-1">.env.local</code>, aplica{" "}
        <code className="rounded bg-amber-100 px-1">db/schema.sql</code> no
        Supabase e corre <code className="rounded bg-amber-100 px-1">npm run seed</code>.
        Depois reinicia o servidor.
      </p>
    </div>
  );
}
