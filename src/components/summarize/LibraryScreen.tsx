import { useState } from "react";
import { Search } from "lucide-react";
import { modeLabels, type SummaryDoc } from "@/lib/summarize-data";
import { SmallTypeBadge } from "./bits";

interface Props {
  docs: SummaryDoc[];
  onOpenDoc: (d: SummaryDoc) => void;
}

export function LibraryScreen({ docs, onOpenDoc }: Props) {
  const [q, setQ] = useState("");
  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="flex flex-1 flex-col pb-28">
      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-bold">Library</h1>
        <p className="mt-1 text-sm text-foreground/50">
          {docs.length} documents · {docs.filter((d) => d.status !== "processing").length}{" "}
          summaries ready
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <Search className="size-4 shrink-0 text-foreground/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your summaries…"
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/40"
          />
        </div>
      </div>

      <div className="flex-1 px-5 pt-5">
        <div className="space-y-2.5">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => d.status !== "processing" && onOpenDoc(d)}
              disabled={d.status === "processing"}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              <SmallTypeBadge type={d.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{d.title}</p>
                <p className="text-[11px] text-foreground/50">
                  {modeLabels[d.mode]} · {d.when}
                </p>
              </div>
              {d.status === "processing" ? (
                <span className="shrink-0 rounded-full bg-sun/40 px-2.5 py-1 text-[11px] font-bold text-foreground/70">
                  Processing
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  Done
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="pt-8 text-center text-sm text-foreground/40">
              No summaries match "{q}".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
