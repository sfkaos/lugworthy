// Shown at once when a brand page isn't cached yet, so the click visibly does something.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="border-b border-line bg-surface-2">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="skeleton h-4 w-32" />
          <div className="mt-5 flex items-center gap-4">
            <div className="skeleton h-16 w-16" />
            <div className="flex flex-col gap-2"><div className="skeleton h-9 w-64" /><div className="skeleton h-4 w-40" /></div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 lg:grid-cols-[1fr_300px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>
        <div className="hidden flex-col gap-4 lg:flex">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-32" />)}</div>
      </div>
    </div>
  );
}
