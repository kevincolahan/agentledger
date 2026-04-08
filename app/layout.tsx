import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentledger.io";

export const metadata: Metadata = {
  title: {
    default: "AgentLedger — Solana Agent Compliance",
    template: "%s | AgentLedger",
  },
  description:
    "The compliance and audit layer for enterprise AI agent operators on Solana. Authorization records, decision audit trails, and tax reporting.",
  keywords: [
    "Solana AI agents", "CMMC AI compliance", "agent compliance",
    "autonomous agent audit", "Solana agent registry", "AI agent governance",
    "x402 compliance", "agent authorization", "crypto tax reporting",
  ],
  authors: [{ name: "AgentLedger" }],
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "AgentLedger — Solana Agent Compliance",
    description: "The compliance and audit layer for enterprise AI agent operators on Solana.",
    siteName: "AgentLedger",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentLedger — Solana Agent Compliance",
    description: "Authorization records, audit trails, and tax reporting for Solana AI agents.",
    creator: "@agentledger",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white antialiased">{children}</body>
    </html>
  );
}
