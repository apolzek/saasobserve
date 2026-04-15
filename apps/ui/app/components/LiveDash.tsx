"use client";
import { useEffect, useState } from "react";

// Fake but convincing live dashboard card that updates on a timer.
// Communicates immediately that this is a metrics/logs/traces product.
export default function LiveDash() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(i);
  }, []);

  const rps      = 38000 + (Math.sin(tick / 3) * 4500 | 0);
  const p99      = 120  + (Math.cos(tick / 2) * 28   | 0);
  const errRate  = Math.max(0, (0.42 + Math.sin(tick / 4) * 0.18).toFixed(2) as unknown as number);
  const logsPerS = 12000 + (Math.cos(tick / 5) * 2000 | 0);
  const spans    = 920   + (Math.sin(tick / 6) * 260  | 0);

  const spark = Array.from({ length: 24 }, (_, i) =>
    35 + Math.sin((tick + i) / 2) * 12 + Math.cos((tick + i) / 3) * 8
  );

  return (
    <div className="card card-glow p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-mario-green border-2 border-black animate-pulse" />
          <div className="pixel text-[10px] text-white">LIVE · tenant-default</div>
        </div>
        <div className="pixel text-[9px] text-mario-yellow">UPDATED {tick * 1.5 | 0}s AGO</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Kpi label="REQUESTS/s"  value={rps.toLocaleString()} color="text-neon-cyan" />
        <Kpi label="p99 LATENCY" value={`${p99}ms`}           color="text-mario-yellow" />
        <Kpi label="ERROR RATE"  value={`${errRate}%`}        color="text-mario-red" />
        <Kpi label="LOGS/s"      value={logsPerS.toLocaleString()} color="text-mario-green" />
        <Kpi label="SPANS/s"     value={spans.toLocaleString()}    color="text-neon-pink" />
      </div>

      <div className="border-[3px] border-black bg-ink-950 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="pixel text-[9px] text-mario-yellow">http_requests_total · 1m rate</div>
          <div className="display text-sm text-ink-200">▲ 8.2%</div>
        </div>
        <svg viewBox="0 0 480 100" className="w-full h-24">
          <defs>
            <linearGradient id="liveFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#00F5FF" stopOpacity="0.55" />
              <stop offset="1" stopColor="#00F5FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" x2="480" y1={y} y2={y} stroke="#1b2235" strokeWidth="1" />
          ))}
          <polyline
            fill="url(#liveFill)"
            stroke="none"
            points={`0,100 ${spark.map((v, i) => `${(i * 480) / (spark.length - 1)},${100 - v}`).join(" ")} 480,100`}
          />
          <polyline
            fill="none"
            stroke="#00F5FF"
            strokeWidth="2"
            points={spark.map((v, i) => `${(i * 480) / (spark.length - 1)},${100 - v}`).join(" ")}
          />
        </svg>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-4">
        {/* trace waterfall */}
        <div className="border-[3px] border-black bg-ink-950 p-3">
          <div className="pixel text-[9px] text-mario-yellow mb-2">TRACE · checkout</div>
          <svg viewBox="0 0 380 110" className="w-full h-28">
            {TRACE.map((s, i) => (
              <g key={i}>
                <rect x={s.x} y={i * 18} width={s.w} height="12" fill={s.c} rx="2" />
                <text x={s.x + 4} y={i * 18 + 10} fontSize="8" fill="#04050a" fontFamily="monospace">{s.n}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* log tail */}
        <div className="border-[3px] border-black bg-ink-950 p-3">
          <div className="pixel text-[9px] text-mario-yellow mb-2">LOGS · tail</div>
          <div className="font-mono text-[11px] leading-5 text-ink-200 overflow-hidden max-h-28">
            <LogLine t={tick} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border-[3px] border-black bg-ink-950 p-3">
      <div className="pixel text-[8px] text-mario-yellow mb-1">{label}</div>
      <div className={`display text-2xl ${color} leading-none`}>{value}</div>
    </div>
  );
}

const TRACE = [
  { n: "HTTP POST /checkout",     x: 0,   w: 360, c: "#049CD8" },
  { n: "auth.Verify",             x: 14,  w: 38,  c: "#FBD000" },
  { n: "db.Tx begin",             x: 56,  w: 42,  c: "#43B047" },
  { n: "payments.Charge",         x: 100, w: 170, c: "#9B30FF" },
  { n: "mq.Publish order.paid",   x: 272, w: 52,  c: "#FF3DA5" },
];

function LogLine({ t }: { t: number }) {
  const lines = [
    { c: "#43B047", l: "INFO  http POST /checkout 201 dur=184ms" },
    { c: "#9da3bf", l: "DEBUG auth jwt ok sub=u_42 ttl=780s" },
    { c: "#FBD000", l: "WARN  payments retry attempt=2 wait=120ms" },
    { c: "#00F5FF", l: "INFO  mq publish topic=orders.paid 1.2kB" },
    { c: "#43B047", l: "INFO  http GET /orders/9a2 200 dur=14ms" },
  ];
  const offset = t % lines.length;
  return (
    <>
      {lines.map((_, i) => {
        const idx = (offset + i) % lines.length;
        return (
          <div key={i} style={{ color: lines[idx].c }} className="truncate">
            {lines[idx].l}
          </div>
        );
      })}
    </>
  );
}
