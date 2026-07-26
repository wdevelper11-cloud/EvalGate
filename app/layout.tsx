import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EvalGate", template: "%s | EvalGate" },
  description: "AI agent evaluation and release readiness harness.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="font-sans antialiased">{children}</body></html>;
}
