import { ArrowRight, Plus, Search } from "lucide-react";
import type { SummaryDoc } from "@/lib/summarize-data";
import { ModeChip, TypeBadge } from "./bits";

interface Props {
  docs: SummaryDoc[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenDoc: (d: SummaryDoc) => void;
  onUpload: () => void;
  onLibrary: () => void;
}

export function HomeScreen({
  docs,
  loading,
  error,
  onRetry,
  onOpenDoc,
  onUpload,
  onLibrary,
}: Props) {
  const recent = docs.filter((d) => !d.status).slice(0, 3);

  return (
    <div className="flex flex-1 flex-col pb-8">
      <header className="sticky top-0 z-20 bg-background/90 px-5 pb-4 pt-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
              S
            </div>
            <p className="font-display text-lg font-bold leading-none">Summarize</p>
          </div>
          <button
            onClick={onLibrary}
            aria-label="Search summaries"
            className="grid size-10 place-items-center rounded-full bg-card text-foreground/60 shadow-sm transition-transform active:scale-95"
          >
            <Search className="size-5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-5 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          <span>{error}</span>
          <button onClick={onRetry} className="shrink-0 underline">
            Retry
          </button>
        </div>
      )}

      <div className="mt-3 px-5">
        <button
          onClick={onUpload}
          className="w-full rounded-4xl bg-primary p-5 text-left text-primary-foreground shadow-xl shadow-primary/25 transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-xl font-bold leading-tight">New summary</p>
              <p className="mt-1 text-sm text-primary-foreground/70">Pick a PDF, DOCX or PPTX</p>
            </div>
            <div className="grid size-16 place-items-center rounded-3xl bg-primary-foreground/15">
              <Plus className="size-8" strokeWidth={2.25} />
            </div>
          </div>
        </button>
      </div>

      <div className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent summaries</h2>
          <button
            onClick={onLibrary}
            className="flex items-center gap-1 text-xs font-bold text-primary"
          >
            Library <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {loading && (
            <div className="rounded-3xl bg-card p-4 text-sm text-foreground/40 shadow-sm">
              Loading your summaries…
            </div>
          )}
          {recent.map((d) => (
            <button
              key={d.id}
              onClick={() => onOpenDoc(d)}
              className="w-full rounded-3xl bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <TypeBadge type={d.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{d.title}</p>
                    <ModeChip mode={d.mode} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-foreground/50">
                    {d.meta} · {d.when}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold text-foreground/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {!loading && !error && recent.length === 0 && (
            <div className="rounded-3xl bg-card p-5 text-center text-sm text-foreground/45 shadow-sm">
              Your generated summaries will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
