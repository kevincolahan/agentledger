"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4 opacity-20">⚠</div>
          <h2 className="text-lg font-medium text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-white/40 mb-6 leading-relaxed">
            An unexpected error occurred. The error has been logged.
            {error.digest && (
              <span className="block mt-1 font-mono text-xs text-white/20">
                ref: {error.digest}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="text-sm bg-green-500 text-black font-semibold px-5 py-2 rounded-lg hover:bg-green-400 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/agents"
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
