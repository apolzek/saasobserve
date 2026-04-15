// Pure-SVG "observability" backdrop.
// Rendered fixed behind the page with pointer-events: none.
// Combines: sparkline line charts, trace span waterfalls, a flamegraph,
// histogram/heatmap tiles, and a scrolling query ghost strip.
// Everything is inline so it works without images and respects the
// existing Mario palette.

export default function ObservabilityBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-[0.55]"
    >
      {/* soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_10%,rgba(4,156,216,0.18),transparent_60%),radial-gradient(50%_40%_at_80%_90%,rgba(155,48,255,0.18),transparent_60%),radial-gradient(40%_30%_at_10%_80%,rgba(229,37,33,0.14),transparent_60%)]" />

      {/* faint grid */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#1b2235" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* left-top sparkline (metrics) */}
      <svg viewBox="0 0 400 120" className="absolute left-6 top-20 w-[380px] h-[120px]">
        <text x="0" y="14" fill="#FBD000" fontFamily="'Press Start 2P'" fontSize="8">
          http_requests_total
        </text>
        <text x="260" y="14" fill="#43B047" fontFamily="monospace" fontSize="10">
          42.3k rps ↑
        </text>
        <polyline
          fill="none"
          stroke="#00F5FF"
          strokeWidth="2"
          strokeLinejoin="round"
          points="0,90 20,70 40,80 60,55 80,65 100,40 120,50 140,30 160,48 180,28 200,42 220,22 240,35 260,18 280,32 300,15 320,28 340,12 360,22 380,8 400,18"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="400" dur="6s" repeatCount="indefinite" />
        </polyline>
        <polyline
          fill="url(#sparkA)"
          stroke="none"
          points="0,90 20,70 40,80 60,55 80,65 100,40 120,50 140,30 160,48 180,28 200,42 220,22 240,35 260,18 280,32 300,15 320,28 340,12 360,22 380,8 400,18 400,120 0,120"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="sparkA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#00F5FF" stopOpacity="0.6" />
            <stop offset="1" stopColor="#00F5FF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* right-top sparkline (error rate) */}
      <svg viewBox="0 0 400 120" className="absolute right-6 top-32 w-[380px] h-[120px]">
        <text x="0" y="14" fill="#FF3DA5" fontFamily="'Press Start 2P'" fontSize="8">
          5xx_rate
        </text>
        <text x="300" y="14" fill="#E52521" fontFamily="monospace" fontSize="10">
          0.47% ↓
        </text>
        <polyline
          fill="none"
          stroke="#FF3DA5"
          strokeWidth="2"
          points="0,40 20,55 40,35 60,62 80,48 100,72 120,58 140,85 160,65 180,90 200,74 220,96 240,82 260,70 280,58 300,48 320,60 340,42 360,54 380,38 400,46"
        />
      </svg>

      {/* trace span waterfall (left) */}
      <svg viewBox="0 0 360 220" className="absolute left-4 top-[42%] w-[360px] h-[220px]">
        <text x="0" y="14" fill="#FBD000" fontFamily="'Press Start 2P'" fontSize="8">
          trace · 4f9c2a…
        </text>
        {SPANS.map((s, i) => (
          <g key={i}>
            <rect x={s.x} y={20 + i * 22} width={s.w} height="12" fill={s.color} rx="2" />
            <text
              x={s.x + 4}
              y={30 + i * 22}
              fontSize="9"
              fill="#04050a"
              fontFamily="monospace"
            >
              {s.name}
            </text>
            <text
              x={s.x + s.w + 4}
              y={30 + i * 22}
              fontSize="9"
              fill="#9da3bf"
              fontFamily="monospace"
            >
              {s.ms}ms
            </text>
          </g>
        ))}
      </svg>

      {/* flamegraph (right middle) */}
      <svg viewBox="0 0 320 160" className="absolute right-6 top-[40%] w-[320px] h-[160px]">
        <text x="0" y="12" fill="#FBD000" fontFamily="'Press Start 2P'" fontSize="8">
          flamegraph · svc-api
        </text>
        {FLAMES.map((row, ri) =>
          row.map((c, ci) => (
            <g key={`${ri}-${ci}`}>
              <rect x={c.x} y={22 + ri * 18} width={c.w} height="14" fill={c.color} stroke="#04050a" strokeWidth="0.5" />
              {c.label && c.w > 32 && (
                <text x={c.x + 4} y={33 + ri * 18} fontSize="9" fill="#04050a" fontFamily="monospace">
                  {c.label}
                </text>
              )}
            </g>
          ))
        )}
      </svg>

      {/* histogram / latency heatmap (bottom left) */}
      <svg viewBox="0 0 360 120" className="absolute left-8 bottom-10 w-[360px] h-[120px]">
        <text x="0" y="14" fill="#FBD000" fontFamily="'Press Start 2P'" fontSize="8">
          latency_p99_ms · heatmap
        </text>
        {HEATMAP.map((row, ri) =>
          row.map((v, ci) => (
            <rect
              key={`${ri}-${ci}`}
              x={ci * 18}
              y={24 + ri * 14}
              width="16"
              height="12"
              fill={heatColor(v)}
              opacity={0.35 + v * 0.65}
            />
          ))
        )}
      </svg>

      {/* vertical log stream (right bottom) */}
      <svg viewBox="0 0 260 200" className="absolute right-8 bottom-8 w-[260px] h-[200px] font-mono">
        <text x="0" y="12" fill="#FBD000" fontFamily="'Press Start 2P'" fontSize="8">
          logs · tail
        </text>
        {LOGS.map((l, i) => (
          <text key={i} x="0" y={28 + i * 14} fontSize="10" fill={l.color} fontFamily="monospace">
            {l.line}
          </text>
        ))}
      </svg>

      {/* scrolling PromQL / SQL ghost strip */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden">
        <div className="whitespace-nowrap will-change-transform animate-[slide_40s_linear_infinite] opacity-30">
          {[...QUERIES, ...QUERIES].map((q, i) => (
            <span
              key={i}
              className="inline-block mx-10 pixel text-[9px]"
              style={{ color: i % 2 ? "#00F5FF" : "#FBD000" }}
            >
              {q}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// static fake-data shapes

const SPANS = [
  { name: "HTTP GET /orders",        x: 0,   w: 320, ms: 184, color: "#049CD8" },
  { name: "auth.Verify",             x: 14,  w: 42,  ms: 7,   color: "#FBD000" },
  { name: "db.Query orders",         x: 60,  w: 140, ms: 78,  color: "#43B047" },
  { name: "cache.Get user:42",       x: 64,  w: 20,  ms: 2,   color: "#FF3DA5" },
  { name: "clickhouse.Insert logs",  x: 208, w: 88,  ms: 44,  color: "#9B30FF" },
  { name: "kafka.Publish order.new", x: 244, w: 50,  ms: 18,  color: "#E52521" },
];

// each row is a frame in the stack, rendered top→bottom like a flamegraph
const FLAMES: { x: number; w: number; color: string; label?: string }[][] = [
  [{ x: 0, w: 320, color: "#049CD8", label: "http.Handler" }],
  [{ x: 0, w: 220, color: "#43B047", label: "auth.Middleware" }, { x: 220, w: 100, color: "#FBD000", label: "rateLimit" }],
  [{ x: 0, w: 90, color: "#9B30FF", label: "jwt.Verify" }, { x: 90, w: 130, color: "#00F5FF", label: "db.Fetch" }, { x: 220, w: 60, color: "#FF3DA5", label: "redis" }, { x: 280, w: 40, color: "#E52521", label: "log" }],
  [{ x: 0, w: 50, color: "#FBD000", label: "decode" }, { x: 50, w: 40, color: "#43B047" }, { x: 90, w: 80, color: "#049CD8", label: "pgx.Query" }, { x: 170, w: 50, color: "#FBD000", label: "scan" }, { x: 220, w: 100, color: "#9B30FF", label: "encode" }],
  [{ x: 10, w: 30, color: "#E52521" }, { x: 100, w: 60, color: "#00F5FF", label: "plan" }, { x: 230, w: 40, color: "#43B047" }, { x: 280, w: 30, color: "#FF3DA5" }],
];

// 6x16 latency heatmap (values 0..1)
const HEATMAP: number[][] = [
  [0.1, 0.2, 0.1, 0.3, 0.2, 0.4, 0.5, 0.3, 0.6, 0.4, 0.5, 0.7, 0.6, 0.5, 0.3, 0.2],
  [0.2, 0.1, 0.3, 0.2, 0.4, 0.5, 0.6, 0.4, 0.7, 0.5, 0.6, 0.8, 0.7, 0.6, 0.4, 0.3],
  [0.3, 0.2, 0.4, 0.3, 0.5, 0.6, 0.7, 0.5, 0.8, 0.7, 0.8, 0.9, 0.8, 0.7, 0.5, 0.4],
  [0.5, 0.4, 0.6, 0.5, 0.7, 0.8, 0.9, 0.7, 1.0, 0.9, 0.9, 1.0, 0.9, 0.8, 0.7, 0.5],
  [0.2, 0.1, 0.3, 0.2, 0.4, 0.5, 0.6, 0.4, 0.7, 0.5, 0.6, 0.8, 0.7, 0.6, 0.4, 0.3],
  [0.1, 0.2, 0.1, 0.3, 0.2, 0.4, 0.5, 0.3, 0.6, 0.4, 0.5, 0.7, 0.6, 0.5, 0.3, 0.2],
];

function heatColor(v: number) {
  if (v < 0.25) return "#049CD8";
  if (v < 0.5)  return "#43B047";
  if (v < 0.75) return "#FBD000";
  return "#E52521";
}

const LOGS = [
  { color: "#43B047", line: "INFO  http req=GET /orders status=200" },
  { color: "#9da3bf", line: "DEBUG cache hit key=user:42 ttl=58s" },
  { color: "#FBD000", line: "WARN  slow query dur=420ms table=orders" },
  { color: "#00F5FF", line: "INFO  kafka publish topic=orders.new" },
  { color: "#E52521", line: "ERROR downstream 503 svc=payments" },
  { color: "#43B047", line: "INFO  http req=POST /checkout 201" },
  { color: "#9da3bf", line: "DEBUG trace_id=4f9c2a span_id=8d17" },
  { color: "#FF3DA5", line: "INFO  otlp exporter sent points=8192" },
  { color: "#FBD000", line: "WARN  gc pause 28ms" },
  { color: "#43B047", line: "INFO  http req=GET /healthz 200" },
];

const QUERIES = [
  'rate(http_requests_total{service="api"}[1m])',
  'histogram_quantile(0.99, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))',
  "SELECT service, count() FROM otel_traces WHERE status_code='ERROR' GROUP BY service",
  'sum by(pod) (container_memory_working_set_bytes{namespace=~"tenant-.*"})',
  "SELECT body FROM otel_logs WHERE SeverityText='ERROR' ORDER BY Timestamp DESC LIMIT 50",
  'topk(5, sum by(route) (rate(http_requests_total{status=~"5.."}[5m])))',
];
