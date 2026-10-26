// Shown at once when a watch page isn't cached yet, so the click visibly does something.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-56" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="skeleton aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-10 w-3/4" />
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
