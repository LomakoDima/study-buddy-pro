import { Pencil, Plus, Search, Target, Zap } from "lucide-react";
import { MODES, type Mode, type SummaryDoc } from "@/lib/summarize-data";
import { ModeChip, TypeBadge } from "./bits";

const modeIcons: Record<Mode, typeof Zap> = { quick: Zap, notes: Pencil, exam: Target };
const modeIconStyles: Record<Mode, string> = {
  quick: "bg-sun text-foreground",
  notes: "bg-primary text-primary-foreground",
  exam: "bg-foreground text-background",
};

interface Props {
  docs: SummaryDoc[];
  mode: Mode;
  onOpenDoc: (d: SummaryDoc) => void;
  onUpload: () => void;
  onSelectMode: (m: Mode) => void;
  onLibrary: () => void;
}

export function HomeScreen({ docs, mode, onOpenDoc, onUpload, onSelectMode, onLibrary }: Props) {
  const recent = docs.filter((d) => d.status !== "processing").slice(0, 3);

  return (
    <div className="flex flex-1 flex-col pb-28">
      <header className="sticky top-0 z-20 bg-background/90 px-5 pb-3 pt-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
              S
            </div>
            <div>
              <p className="font-display text-base font-bold leading-none">Summarize</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground/45">
                Study notes, instantly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onLibrary}
              aria-label="Search summaries"
              className="grid size-9 place-items-center rounded-full bg-card text-foreground/60 shadow-sm transition-transform active:scale-95"
            >
              <Search className="size-4" />
            </button>
            <div className="grid size-9 place-items-center rounded-full bg-sun text-xs font-extrabold text-foreground shadow-sm">
              AM
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          <button className="rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background">
            Recent
          </button>
          <button
            onClick={onLibrary}
            className="rounded-full bg-card px-4 py-2 text-xs font-bold text-foreground/50 shadow-sm transition-colors active:bg-muted"
          >
            Library
          </button>
        </div>
      </header>

      <div className="px-5 pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Tuesday</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight">Good morning, Ava</h1>
        <p className="mt-1 text-sm text-foreground/55">
          You've summarized {recent.length} lectures this week.
        </p>
      </div>

      <div className="mt-5 px-5">
        <button
          onClick={onUpload}
          className="w-full rounded-4xl bg-primary p-5 text-left text-primary-foreground shadow-xl shadow-primary/25 transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-xl font-bold leading-tight">New summary</p>
              <p className="mt-1 text-sm text-primary-foreground/70">Pick a PDF, DOCX or PPTX</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/15">
              <Plus className="size-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["PDF", "DOCX", "PPTX"].map((f) => (
              <span
                key={f}
                className="rounded-full bg-primary-foreground/15 px-3 py-1 text-[11px] font-bold"
              >
                {f}
              </span>
            ))}
          </div>
        </button>
      </div>

      <div className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Choose a mode</h2>
          <span className="text-xs font-bold text-primary">Sets your default</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {MODES.map((m) => {
            const Icon = modeIcons[m.id];
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`rounded-2xl bg-card p-3 text-left shadow-sm transition-all active:scale-[0.97] ${
                  selected ? "ring-2 ring-primary" : ""
                }`}
              >
                <div
                  className={`grid size-9 place-items-center rounded-xl ${modeIconStyles[m.id]}`}
                >
                  <Icon className="size-4" />
                </div>
                <p className="mt-2 text-sm font-bold">{m.label}</p>
                <p className="mt-0.5 text-[11px] text-foreground/50">{m.short}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent summaries</h2>
          <button onClick={onLibrary} className="text-xs font-bold text-primary">
            See all
          </button>
        </div>
        <div className="mt-3 space-y-3">
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
        </div>
      </div>
    </div>
  );
}
