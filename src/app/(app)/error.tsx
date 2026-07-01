"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card border-red-200 bg-red-50 p-6">
      <p className="text-sm font-semibold text-red-900">Ocorreu um erro</p>
      <p className="mt-1 text-sm text-red-800">{error.message}</p>
      <button onClick={reset} className="btn-secondary mt-4">
        Tentar de novo
      </button>
    </div>
  );
}
