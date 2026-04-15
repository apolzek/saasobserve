"use client";
import { useState } from "react";
import Link from "next/link";

const api = (p: string) => `/api/proxy${p}`;

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("admin@saasobserve.io");
  const [password, setPassword] = useState("saasobserve");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { email, password, name };
    const r = await fetch(api(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      setErr((await r.text()) || "something went wrong");
      setBusy(false); return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <div className="absolute left-10 top-10 coin animate-bob" />
      <div className="absolute right-14 top-24 spark animate-sparkle" />
      <div className="absolute left-1/4 bottom-14 spark animate-sparkle" style={{ animationDelay: "0.4s" }} />

      <div className="card card-glow p-8 w-full max-w-md">
        <Link href="/" className="pixel text-[9px] text-mario-yellow hover:text-white">← back</Link>

        <div className="flex justify-center mt-2 mb-6">
          <div className="qmark-block w-12 h-12 grid place-items-center">
            <span className="pixel text-[16px] text-black">?</span>
          </div>
        </div>

        <h1 className="pixel text-sm text-white text-center mb-1 drop-shadow-[2px_2px_0_#000]">
          {mode === "login" ? "PRESS START" : "NEW PLAYER"}
        </h1>
        <p className="display text-lg text-ink-200 text-center mb-6">
          {mode === "login" ? "enter credentials to continue" : "pick a handle and join"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="EMAIL"   value={email}    onChange={setEmail}    type="email" />
          {mode === "signup" && (
            <Field label="NAME"  value={name}     onChange={setName}     type="text"  placeholder="luigi" />
          )}
          <Field label="PASSWORD" value={password} onChange={setPassword} type="password" />

          {err && (
            <div className="pixel text-[9px] text-mario-red border-[3px] border-black bg-mario-yellow p-3">
              ⚠ {err}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn btn-red w-full">
            {busy ? "LOADING…" : mode === "login" ? "▶ LOGIN" : "★ CREATE PLAYER"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-[3px] bg-black flex-1" />
          <span className="pixel text-[9px] text-ink-200">OR</span>
          <div className="h-[3px] bg-black flex-1" />
        </div>

        <a href={`${"/api/proxy"}/api/auth/google/start`} className="btn btn-blue w-full">
          <svg className="w-4 h-4" viewBox="0 0 48 48" fill="currentColor" aria-hidden>
            <path d="M44.5 20H24v8.5h11.7C34.7 33 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34 5.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.6-.2-4z"/>
          </svg>
          CONTINUE WITH GOOGLE
        </a>

        <button
          type="button"
          onClick={() => { setErr(null); setMode(mode === "login" ? "signup" : "login"); }}
          className="pixel text-[9px] text-mario-yellow hover:text-white w-full mt-5"
        >
          {mode === "login" ? "→ NEW? CREATE PLAYER" : "→ HAVE ACCOUNT? LOGIN"}
        </button>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type: string; placeholder?: string }) {
  return (
    <label className="block">
      <div className="pixel text-[9px] text-mario-yellow mb-2">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-ink-900 border-[3px] border-black text-white display text-xl
                   px-3 py-2 outline-none focus:border-mario-yellow shadow-[4px_4px_0_0_#000]"
        required
      />
    </label>
  );
}
