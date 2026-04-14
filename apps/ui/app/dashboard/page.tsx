"use client";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; picture: string; tenant: string; grafanaUrl: string };
type KeyRow = { id: string; label: string; prefix: string; masked: string; createdAt: string };

const api = (p: string) => `/api/proxy${p}`;

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const meRes = await fetch(api("/api/me"), { credentials: "include" });
    if (meRes.status === 401) { window.location.href = "/login"; return; }
    setMe(await meRes.json());
    const ks = await fetch(api("/api/keys"), { credentials: "include" });
    setKeys(await ks.json());
  }
  useEffect(() => { load(); }, []);

  async function createKey() {
    const label = prompt("Label for this key?", "default") || "default";
    const r = await fetch(api("/api/keys"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const j = await r.json();
    setNewKey(j.key);
    await load();
  }
  async function deleteKey(id: string) {
    if (!confirm("Revoke this key? Anything using it will start failing.")) return;
    await fetch(api(`/api/keys/${id}`), { method: "DELETE", credentials: "include" });
    await load();
  }
  async function logout() {
    await fetch(api("/api/auth/logout"), { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  if (!me) return <main className="p-10 text-ink-100/70">Loading…</main>;

  return (
    <main className="min-h-screen">
      <nav className="border-b border-ink-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-400 to-fuchsia-500" />
            <span className="font-semibold">saasobserve</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {me.picture && <img src={me.picture} alt="" className="w-8 h-8 rounded-full" />}
            <span className="text-ink-100/70">{me.email}</span>
            <button onClick={logout} className="btn btn-ghost text-xs">logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Welcome, {me.name.split(" ")[0]}</h1>
            <p className="text-ink-100/70">
              Tenant <code className="text-accent-400">{me.tenant || "(provisioning…)"}</code>
            </p>
          </div>
          {me.grafanaUrl && (
            <a href={me.grafanaUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Open my Grafana ↗
            </a>
          )}
        </header>

        <section className="card p-6">
          <h2 className="font-semibold mb-1">Send telemetry</h2>
          <p className="text-sm text-ink-100/70 mb-4">
            Point any OpenTelemetry SDK or Collector at the gateway and set <code>X-Tenant-Key</code>.
          </p>
          <pre className="bg-ink-950 border border-ink-800 rounded-lg p-4 text-xs overflow-x-auto">
{`# OTLP HTTP
curl https://otlp.saasobserve.io/v1/metrics \\
  -H "X-Tenant-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  --data-binary @metrics.json

# OTel Collector exporter
exporters:
  otlphttp:
    endpoint: https://otlp.saasobserve.io
    headers:
      X-Tenant-Key: sk_live_...`}
          </pre>
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">API keys</h2>
            <button onClick={createKey} className="btn btn-primary text-sm">+ Create key</button>
          </div>

          {newKey && (
            <div className="mb-4 border border-accent-500/40 bg-accent-500/10 rounded-lg p-4">
              <p className="text-xs text-accent-400 uppercase tracking-wide mb-1">Copy this now — it won't be shown again</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm break-all">{newKey}</code>
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="text-left text-ink-100/50 text-xs uppercase">
              <tr><th className="py-2">Label</th><th>Key</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-ink-100/50 text-center">No keys yet.</td></tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-ink-800">
                  <td className="py-3">{k.label}</td>
                  <td className="font-mono text-xs">{k.masked}</td>
                  <td className="text-ink-100/60">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="text-right"><button onClick={() => deleteKey(k.id)} className="text-red-400 hover:text-red-300 text-xs">revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
