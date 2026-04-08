import Link from "next/link";

export default function UnsubscribedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-5">
          <span className="text-white/40">✓</span>
        </div>
        <h1 className="text-lg font-medium text-white mb-2">Unsubscribed</h1>
        <p className="text-sm text-white/40 mb-6 leading-relaxed">
          You've been removed from our outreach list. You won't receive any more emails from us.
        </p>
        <Link href="/" className="text-xs text-white/30 hover:text-white/50 transition-colors">
          Return to AgentLedger.io
        </Link>
      </div>
    </div>
  );
}
