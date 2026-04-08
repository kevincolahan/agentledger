import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl font-semibold text-white/10 mb-4">404</div>
        <h2 className="text-lg font-medium text-white mb-2">Page not found</h2>
        <p className="text-sm text-white/40 mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/agents"
          className="text-sm bg-green-500 text-black font-semibold px-5 py-2 rounded-lg hover:bg-green-400 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
