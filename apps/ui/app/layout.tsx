import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "saasobserve — open observability cloud",
  description: "OpenTelemetry-native metrics, logs, and traces. Per-tenant Grafana. Self-hostable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
