"use client";
import { useEffect, useState } from "react";

type Me  = { id: string; email: string; name: string; picture: string; tenant: string; grafanaUrl: string };
type Key = { id: string; label: string; prefix: string; masked: string; createdAt: string };

const api = (p: string) => `/api/proxy${p}`;

export default function Dashboard() {
  const [me, setMe]       = useState<Me | null>(null);
  const [keys, setKeys]   = useState<Key[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const r = await fetch(api("/api/me"), { credentials: "include" });
    if (r.status === 401) { window.location.href = "/login"; return; }
    setMe(await r.json());
    const ks = await fetch(api("/api/keys"), { credentials: "include" });
    setKeys(await ks.json());
  }
  useEffect(() => { load(); }, []);

  async function createKey() {
    const label = prompt("Name for this power-up?", "default") || "default";
    const r = await fetch(api("/api/keys"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }),
    });
    const j = await r.json();
    setNewKey(j.key);
    await load();
  }
  async function deleteKey(id: string) {
    if (!confirm("GAME OVER this key? any client using it will fail.")) return;
    await fetch(api(`/api/keys/${id}`), { method: "DELETE", credentials: "include" });
    await load();
  }
  async function logout() {
    await fetch(api("/api/auth/logout"), { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  if (!me) return <main className="p-10 pixel text-[10px] text-mario-yellow">LOADING…</main>;

  const tenant = me.tenant || "provisioning";

  return (
    <main className="min-h-screen">
      <nav className="border-b-[3px] border-black bg-ink-900">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="qmark-block w-9 h-9 grid place-items-center">
              <span className="pixel text-[12px] text-black">?</span>
            </div>
            <span className="pixel text-[12px] text-white">SAASOBSERVE</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {me.picture
                ? <img src={me.picture} alt="" className="w-8 h-8 border-[3px] border-black" />
                : <div className="w-8 h-8 bg-mario-red border-[3px] border-black" />}
              <div>
                <div className="pixel text-[9px] text-white">{me.name || "PLAYER 1"}</div>
                <div className="display text-sm text-ink-200 leading-none">{me.email}</div>
              </div>
            </div>
            <button onClick={logout} className="btn btn-ghost" style={{ padding: "0.5rem 0.8rem" }}>
              LOGOUT
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* HUD */}
        <header className="card p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="pixel text-[9px] text-mario-yellow mb-2">WORLD</div>
            <div className="pixel text-lg text-white drop-shadow-[2px_2px_0_#000]">
              TENANT · {tenant.toUpperCase()}
            </div>
            <div className="display text-xl text-ink-200 mt-2">
              lives <span className="text-mario-red">♥♥♥</span> · coins{" "}
              <span className="text-mario-yellow">{keys.length * 100}</span> · level 1-1
            </div>
          </div>
          {me.grafanaUrl && (
            <a href={me.grafanaUrl} target="_blank" rel="noreferrer" className="btn btn-green">
              ★ OPEN MY GRAFANA
            </a>
          )}
        </header>

        {/* quick start */}
        <section className="card p-6">
          <div className="pixel text-[11px] text-white mb-3">🔥 SHIP TELEMETRY</div>
          <p className="display text-lg text-ink-200 mb-4">
            point any OpenTelemetry SDK or collector at the gateway with your X-Tenant-Key header.
          </p>
          <pre className="bg-ink-950 border-[3px] border-black p-4 text-xs overflow-x-auto display leading-relaxed">
{`# OTLP HTTP
curl https://otlp.saasobserve.io/v1/metrics \\
  -H "X-Tenant-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  --data-binary @metrics.json

# OpenTelemetry Collector exporter
exporters:
  otlphttp:
    endpoint: https://otlp.saasobserve.io
    headers:
      X-Tenant-Key: sk_live_...`}
          </pre>
        </section>

        {/* api keys */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="pixel text-[11px] text-white">🔑 POWER-UP KEYS</div>
            <button onClick={createKey} className="btn btn-yellow">+ NEW KEY</button>
          </div>

          {newKey && (
            <div className="mb-5 border-[3px] border-black bg-mario-yellow p-4 text-black">
              <div className="pixel text-[9px] mb-2">⚠ COPY NOW — WON'T SHOW AGAIN</div>
              <div className="flex items-center gap-2">
                <code className="display text-xl break-all flex-1">{newKey}</code>
                <button
                  className="btn btn-red"
                  style={{ padding: "0.45rem 0.7rem" }}
                  onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? "✔ COPIED" : "COPY"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {keys.length === 0 && (
              <div className="display text-xl text-ink-200 text-center py-6">
                no keys yet — press <span className="text-mario-yellow">+ NEW KEY</span>
              </div>
            )}
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-4 border-[3px] border-black bg-ink-800 p-4">
                <div className="coin animate-bob" />
                <div className="flex-1 min-w-0">
                  <div className="pixel text-[10px] text-white truncate">{k.label.toUpperCase()}</div>
                  <div className="display text-lg text-ink-200 truncate">{k.masked}</div>
                </div>
                <div className="display text-sm text-ink-200">
                  {new Date(k.createdAt).toLocaleDateString()}
                </div>
                <button onClick={() => deleteKey(k.id)} className="btn btn-red" style={{ padding: "0.4rem 0.6rem" }}>
                  REVOKE
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
