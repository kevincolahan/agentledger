export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-white/[0.04] rounded-lg" />
      <div className="h-4 w-64 bg-white/[0.02] rounded-lg" />
      <div className="grid grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white/[0.03] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 mt-2">
        <div className="h-64 bg-white/[0.02] rounded-xl" />
        <div className="h-64 bg-white/[0.02] rounded-xl" />
      </div>
    </div>
  );
}
