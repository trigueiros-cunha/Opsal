import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · OPSAL" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; erro?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            OP
          </div>
          <h1 className="text-xl font-bold text-slate-900">OPSAL</h1>
          <p className="text-sm text-slate-500">Gestão de manutenções AL</p>
        </div>
        <div className="card p-6">
          <LoginForm next={searchParams.next} erro={searchParams.erro} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Acesso único · uma password
        </p>
      </div>
    </div>
  );
}
