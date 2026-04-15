import "./globals.css";
import type { Metadata } from "next";
import ObservabilityBg from "./components/ObservabilityBg";

export const metadata: Metadata = {
  title: "SAASOBSERVE — metrics, logs & traces, player 1 ready",
  description: "OpenTelemetry-native observability SaaS. Ship OTLP, get a Grafana + VictoriaMetrics + ClickHouse stack in your own tenant namespace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="crt min-h-screen antialiased relative">
        <ObservabilityBg />
        {children}
      </body>
    </html>
  );
}
