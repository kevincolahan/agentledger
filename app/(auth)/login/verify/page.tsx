export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30
          flex items-center justify-center mx-auto mb-5 animate-pulse">
          <span className="text-green-400 text-xl">✓</span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Signing you in…</h1>
        <p className="text-sm text-white/40">Verifying your magic link.</p>
      </div>
    </div>
  );
}
