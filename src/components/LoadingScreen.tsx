export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-6 text-slate-950">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-sm font-medium">Restoring your workspace</span>
      </div>
    </main>
  )
}
