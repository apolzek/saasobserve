import Link from "next/link";
import LiveDash from "./components/LiveDash";

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      {/* sky + clouds marquee */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] -z-10
                      bg-gradient-to-b from-mario-sky via-mario-blue/60 to-transparent" />
      <Clouds />

      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="qmark-block w-10 h-10 grid place-items-center">
            <span className="pixel text-[14px] text-black">?</span>
          </div>
          <span className="pixel text-sm text-white drop-shadow-[2px_2px_0_#000]">SAASOBSERVE</span>
        </div>
        <div className="flex items-center gap-3">
          <a className="pixel text-[10px] text-white/80 hover:text-mario-yellow" href="#world">WORLD 1-1</a>
          <a className="pixel text-[10px] text-white/80 hover:text-mario-yellow" href="#items">ITEMS</a>
          <a className="pixel text-[10px] text-white/80 hover:text-mario-yellow"
             href="https://github.com/apolzek/saasobserve">GITHUB</a>
          <Link href="/login" className="btn btn-yellow">START</Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-24 text-center relative">
        {/* floating coins */}
        <div className="absolute left-10 top-10 coin animate-bob" />
        <div className="absolute right-16 top-24 coin animate-bob" style={{ animationDelay: "0.3s" }} />
        <div className="absolute left-1/4 top-40 spark animate-sparkle" />
        <div className="absolute right-1/4 top-32 spark animate-sparkle" style={{ animationDelay: "0.6s" }} />

        <p className="pixel text-[10px] tracking-[0.4em] text-mario-yellow mb-6">
          ◆ OBSERVABILITY SAAS · METRICS · LOGS · TRACES ◆
        </p>
        <h1 className="pixel text-4xl md:text-6xl leading-[1.1] title-gradient">
          METRICS.<br />
          LOGS.<br />
          <span className="text-neon-cyan" style={{ WebkitTextStroke: "2px #000" }}>TRACES.</span>
          <span className="block mt-2 text-mario-yellow" style={{ WebkitTextStroke: "2px #000" }}>POWER UP.</span>
        </h1>
        <p className="display text-2xl text-ink-100/90 max-w-2xl mx-auto mt-8">
          Ship OTLP to one gateway. Land in your own namespace with
          <span className="text-neon-cyan"> VictoriaMetrics</span>,
          <span className="text-neon-pink"> ClickHouse</span> and a
          <span className="text-mario-yellow"> Grafana</span> that belongs to <i>you</i>.
          Dedicated dashboards, hard tenant isolation, GitOps-provisioned.
        </p>
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
          <Badge color="neon-cyan"   label="prometheus remote_write" />
          <Badge color="neon-pink"   label="otlp/grpc + http" />
          <Badge color="mario-yellow" label="loki-compatible logs" />
          <Badge color="mario-green"  label="tempo-style traces" />
        </div>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link href="/login" className="btn btn-red">▶ PLAYER 1 — Start</Link>
          <a href="#world" className="btn btn-ghost">? how it works</a>
        </div>
        <p className="mt-6 display text-ink-200 text-lg">
          default credentials ready ·{" "}
          <code className="pixel text-[10px] text-mario-yellow">admin@saasobserve.io</code>{" "}
          /{" "}
          <code className="pixel text-[10px] text-mario-yellow">saasobserve</code>
        </p>
      </section>

      {/* live dashboard preview */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-6">
          <p className="pixel text-[10px] text-mario-yellow mb-3">▼ LIVE FROM THE DEMO TENANT ▼</p>
          <p className="display text-xl text-ink-200">
            this is exactly what your Grafana would be graphing — in your own namespace.
          </p>
        </div>
        <LiveDash />
      </section>

      {/* power-up grid */}
      <section id="items" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="pixel text-[14px] text-mario-yellow mb-8 drop-shadow-[2px_2px_0_#000]">
          ⭐ POWER-UPS
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {POWERUPS.map((p) => (
            <article key={p.title} className="card card-glow p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 grid place-items-center text-xl ${p.bg}`}>{p.icon}</div>
                <h3 className="pixel text-[11px] text-white">{p.title}</h3>
              </div>
              <p className="display text-lg text-ink-200 leading-snug">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* world 1-1 steps */}
      <section id="world" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="pixel text-[14px] text-mario-yellow mb-8 drop-shadow-[2px_2px_0_#000]">
          🏰 WORLD 1-1 — HOW IT WORKS
        </h2>
        <ol className="grid md:grid-cols-4 gap-5">
          {STEPS.map(([n, t, b]) => (
            <li key={t} className="card p-5">
              <div className="pixel text-[10px] text-mario-yellow mb-2">STEP {n}</div>
              <div className="pixel text-[11px] text-white mb-2">{t}</div>
              <div className="display text-lg text-ink-200">{b}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ground + pipe decoration */}
      <section className="relative">
        <div className="absolute right-10 bottom-20 flex items-end gap-6">
          <div className="pipe w-16 h-24" />
          <div className="pipe w-16 h-32" />
        </div>
        <div className="ground h-20" />
      </section>

      <footer className="py-6 text-center pixel text-[9px] text-ink-200">
        © SAASOBSERVE · APACHE 2.0 · BUILT WITH OTEL · VICTORIAMETRICS · CLICKHOUSE · GRAFANA
      </footer>
    </main>
  );
}

const POWERUPS: { title: string; body: string; icon: string; bg: string }[] = [
  { title: "FIRE FLOWER — OTLP Ingest",  body: "One gateway. Drop OTLP from any SDK or collector. We route to your tenant.", icon: "🔥", bg: "bg-mario-red border-[3px] border-black" },
  { title: "STAR — Tenant Isolation",    body: "Namespace per customer. Dedicated collector, VictoriaMetrics, ClickHouse, Grafana.", icon: "⭐", bg: "bg-mario-yellow border-[3px] border-black" },
  { title: "1-UP — GitOps Provisioning", body: "Signup commits manifests. ArgoCD reconciles. Zero kubectl from the control plane.", icon: "🍄", bg: "bg-mario-green border-[3px] border-black" },
  { title: "CAPE — Scale Tested",        body: "k6 harness validates 100 tenants on a single cluster with honest thresholds.", icon: "🦸", bg: "bg-mario-blue border-[3px] border-black" },
  { title: "KEY — Your Dashboards",      body: "Your Grafana, your plugins, your users. We just keep it wired and running.", icon: "🔑", bg: "bg-neon-purple border-[3px] border-black" },
  { title: "HEART — Open Source",        body: "Apache 2.0. Self-host or pay us to run it. No proprietary lock-in on telemetry.", icon: "💖", bg: "bg-neon-pink border-[3px] border-black" },
];

const STEPS: [string, string, string][] = [
  ["1", "SIGN UP", "Email+password or Google SSO. Your sub is your tenant id."],
  ["2", "GET KEY", "Generated on first login, hashed at rest, shown once."],
  ["3", "SHIP OTLP", "Any SDK. Header: X-Tenant-Key: sk_live_…"],
  ["4", "OPEN GRAFANA", "Dedicated instance in your tenant namespace."],
];

function Badge({ color, label }: { color: "neon-cyan" | "neon-pink" | "mario-yellow" | "mario-green"; label: string }) {
  const cls = {
    "neon-cyan":    "text-neon-cyan",
    "neon-pink":    "text-neon-pink",
    "mario-yellow": "text-mario-yellow",
    "mario-green":  "text-mario-green",
  }[color];
  return (
    <span className={`pixel text-[8px] px-3 py-2 border-[3px] border-black shadow-[2px_2px_0_#000] bg-ink-900 ${cls}`}>
      {label}
    </span>
  );
}

function Clouds() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 h-24 overflow-hidden -z-10">
      <div className="flex gap-24 animate-slide whitespace-nowrap w-[200%]">
        {Array.from({ length: 12 }).map((_, i) => <Cloud key={i} />)}
      </div>
    </div>
  );
}
function Cloud() {
  return (
    <svg width="90" height="40" viewBox="0 0 90 40" className="shrink-0">
      <g fill="#fff" stroke="#000" strokeWidth="3">
        <rect x="10" y="14" width="70" height="16" />
        <rect x="4"  y="20" width="82" height="8" />
        <rect x="18" y="8"  width="20" height="8" />
        <rect x="46" y="10" width="18" height="6" />
      </g>
    </svg>
  );
}
