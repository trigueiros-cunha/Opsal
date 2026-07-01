import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { temSessao } from "@/lib/session";

// Shell autenticado. O middleware já protege, mas revalidamos no servidor.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await temSessao())) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
