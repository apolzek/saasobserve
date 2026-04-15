import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SAASOBSERVE — PLAYER 1 READY",
  description: "Start your observability quest. OpenTelemetry → per-tenant Grafana. Power up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="crt min-h-screen antialiased">{children}</body>
    </html>
  );
}
