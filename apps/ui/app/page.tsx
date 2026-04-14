import Link from "next/link";

export default function Landing() {
  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(124,156,255,0.18),transparent)]" />

      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-400 to-fuchsia-500" />
          <span className="font-semibold">saasobserve</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a className="text-ink-100/70 hover:text-white" href="#features">features</a>
          <a className="text-ink-100/70 hover:text-white" href="#pricing">pricing</a>
          <a className="text-ink-100/70 hover:text-white" href="https://github.com/apolzek/saasobserve">github</a>
          <Link href="/login" className="btn btn-ghost">sign in</Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-28 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-accent-400 mb-4">open observability cloud</p>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
          Your data.<br />
          <span className="gradient-text">Your Grafana.</span><br />
          OpenTelemetry native.
        </h1>
        <p className="mt-6 text-lg text-ink-100/70 max-w-2xl mx-auto">
          Ship OTLP to a single endpoint. Get metrics, logs, and traces in a Grafana that
          belongs to you — running in an isolated tenant namespace with VictoriaMetrics
          and ClickHouse behind it.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link href="/login" className="btn btn-primary">Start free with Google</Link>
          <a href="#how" className="btn btn-ghost">How it works</a>
        </div>
        <p className="mt-4 text-xs text-ink-100/50">no credit card · your data stays in your tenant</p>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { t: "Single OTLP endpoint", b: "Point any OTel SDK or Collector at our gateway with your API key. We route your data to your tenant automatically." },
          { t: "Isolated per tenant", b: "Each customer gets its own namespace, collector, VictoriaMetrics, ClickHouse, and Grafana. No noisy neighbours." },
          { t: "GitOps-native", b: "Tenants are provisioned by committing to a Git repo. ArgoCD picks it up. Every change is reviewable and reversible." },
          { t: "Scale-tested to 100+", b: "Load-tested harness spins up 100 tenants and hammers the gateway with k6 to validate ingestion under real pressure." },
          { t: "Bring your own dashboards", b: "Your Grafana, your dashboards, your users. We just keep it running and pointed at the right datasources." },
          { t: "Open source", b: "Apache 2.0. Self-host it yourself or use our managed tier. No proprietary lock-in on your telemetry." },
        ].map((f) => (
          <div key={f.t} className="card p-6">
            <h3 className="font-semibold mb-2">{f.t}</h3>
            <p className="text-sm text-ink-100/70">{f.b}</p>
          </div>
        ))}
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-semibold mb-8">How it works</h2>
        <ol className="grid md:grid-cols-4 gap-4">
          {[
            ["1", "Sign up with Google", "Your Google sub becomes your stable tenant identifier."],
            ["2", "Copy your API key", "Generated on first login, hashed at rest, shown once."],
            ["3", "Ship OTLP", "Any SDK or Collector. Header: X-Tenant-Key: sk_live_…"],
            ["4", "Open your Grafana", "Dedicated instance in your tenant namespace, already wired up."],
          ].map(([n, t, b]) => (
            <li key={t} className="card p-6">
              <div className="text-accent-400 font-mono text-sm mb-2">step {n}</div>
              <div className="font-semibold mb-1">{t}</div>
              <div className="text-sm text-ink-100/70">{b}</div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-ink-800 py-8 text-center text-sm text-ink-100/50">
        saasobserve · Apache 2.0 · built on OpenTelemetry, VictoriaMetrics, ClickHouse, Grafana
      </footer>
    </main>
  );
}
