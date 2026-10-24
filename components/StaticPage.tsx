export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-4 font-serif text-4xl font-semibold tracking-tight">{title}</h1>
      <div className="prose-lw text-lg leading-relaxed">{children}</div>
    </div>
  );
}
