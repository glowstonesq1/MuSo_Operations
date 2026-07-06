"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setBusy(true);
    setError(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setError(error.message);
      else setInfo("Account created. If email confirmation is on, check your inbox; otherwise sign in. An admin will assign your role.");
    }
    setBusy(false);
  }

  async function oauth(provider: "google" | "azure") {
    setError(null);
    const supabase = createClient();
    const label = provider === "google" ? "Google" : "Microsoft/Outlook";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
        ...(provider === "azure" ? { scopes: "email" } : {}),
      },
    });
    if (error || !data?.url) {
      setError(error?.message ?? `${label} sign-in failed to start.`);
      return;
    }
    // probe before redirecting so a not-configured provider shows a helpful
    // message instead of Supabase's raw 400 JSON page
    try {
      const probe = await fetch(data.url, { redirect: "manual" });
      if (probe.status === 400) {
        setError(
          `${label} sign-in is not switched on yet. Use email + password, or ask the admin to enable the ${label} provider in Supabase (Authentication -> Providers).`
        );
        return;
      }
    } catch {
      // opaque redirect / CORS — provider is configured, continue
    }
    window.location.href = data.url;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold">MuSo Ops Command Center</h1>
        <p className="mb-4 text-sm text-slate-500">Museum of Solutions, Mumbai — internal ops</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => oauth("google")} className="btn-outline justify-center">
            Google
          </button>
          <button onClick={() => oauth("azure")} className="btn-outline justify-center">
            Outlook / Microsoft
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> or email <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-700">{info}</p>}
          <button className="btn-primary w-full justify-center" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="mt-3 w-full text-center text-sm text-slate-500 underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          New accounts start as read-only viewers. An admin promotes roles from the Staff page.
        </p>
      </div>
    </div>
  );
}
