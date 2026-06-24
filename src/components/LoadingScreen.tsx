export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4EFE6] px-6 text-[#080B14]">
      <div className="flex items-center gap-3 rounded-full border border-[#E3DACC] bg-[#FFFCF6] px-5 py-3 shadow-[0_10px_30px_rgba(8,11,20,0.06)]">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#5EF2C1]" />
        <span className="text-sm font-medium">Restoring your workspace</span>
      </div>
    </main>
  )
}
