"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-sm">
        <div className="text-3xl mb-3 opacity-20">⚠</div>
        <h2 className="text-base font-medium text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-white/40 mb-5 leading-relaxed">
          {error.message || "An unexpected error occurred loading this page."}
        </p>
        <button
          onClick={reset}
          className="text-sm bg-white/[0.06] text-white/70 px-5 py-2 rounded-lg
            hover:bg-white/[0.08] transition-colors border border-white/[0.08]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
