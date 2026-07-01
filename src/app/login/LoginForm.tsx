"use client";

import { useState } from "react";

export function LoginForm({ next, erro }: { next?: string; erro?: string }) {
  const [password, setPassword] = useState("");
  const [aSubmeter, setASubmeter] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(
    erro ? "Password incorreta." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setASubmeter(true);
    setErroLocal(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next: next ?? "/" }),
      });
      if (res.ok) {
        const { redirect } = (await res.json()) as { redirect: string };
        window.location.href = redirect || "/";
        return;
      }
      if (res.status === 401) setErroLocal("Password incorreta.");
      else setErroLocal("Não foi possível entrar. Tenta de novo.");
    } catch {
      setErroLocal("Erro de rede. Tenta de novo.");
    } finally {
      setASubmeter(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {erroLocal ? (
        <p className="text-sm text-red-600">{erroLocal}</p>
      ) : null}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={aSubmeter || !password}
      >
        {aSubmeter ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
