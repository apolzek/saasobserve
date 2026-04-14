// k6 OTLP ingest load test.
//
// Usage:
//   k6 run -e ENDPOINT=http://localhost:4318 -e KEYS_FILE=./keys.txt tests/load/k6-ingest.js
//
// KEYS_FILE is a plain text file, one sk_live_* key per line. The script
// round-robins across keys to simulate traffic from many tenants. For the
// 100-tenant scale harness, scale-100-tenants.sh generates this file.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

const ENDPOINT = __ENV.ENDPOINT || "http://localhost:4318";

const keys = new SharedArray("keys", () => {
  const f = __ENV.KEYS_FILE;
  if (!f) return ["sk_live_test_000_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"];
  return open(f).trim().split("\n").filter((l) => l.length > 0);
});

export const options = {
  scenarios: {
    steady: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },   // warm up
        { duration: "2m",  target: 200 },  // steady state
        { duration: "1m",  target: 500 },  // burst
        { duration: "30s", target: 0 },    // drain
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.02"],  // 98% accepted
    http_req_duration: ["p(95)<500"],  // p95 under 500ms
  },
};

function metricPayload(serviceName) {
  const now = Date.now() * 1_000_000; // ns
  return JSON.stringify({
    resourceMetrics: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: serviceName } }] },
      scopeMetrics: [{
        scope: { name: "k6-saasobserve-loadtest" },
        metrics: [{
          name: "requests_total",
          unit: "1",
          sum: {
            aggregationTemporality: 2,
            isMonotonic: true,
            dataPoints: [{
              asInt: randomIntBetween(1, 1000),
              startTimeUnixNano: now,
              timeUnixNano: now,
              attributes: [{ key: "method", value: { stringValue: "GET" } }],
            }],
          },
        }],
      }],
    }],
  });
}

export default function () {
  const key = keys[Math.floor(Math.random() * keys.length)];
  const tenant = key.split("_")[2] || "unknown";
  const res = http.post(`${ENDPOINT}/v1/metrics`, metricPayload(`svc-${tenant}`), {
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Key": key,
    },
    tags: { tenant },
  });
  check(res, { "accepted": (r) => r.status >= 200 && r.status < 300 });
  sleep(randomIntBetween(0, 1));
}
