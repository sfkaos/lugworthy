export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-40" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden flex-col gap-4 lg:flex">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16" />)}</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div>
      </div>
    </div>
  );
}
