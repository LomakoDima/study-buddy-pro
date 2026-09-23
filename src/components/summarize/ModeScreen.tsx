import { Check, ChevronLeft, Pencil, Target, Zap } from "lucide-react";
import { MODES, type Mode } from "@/lib/summarize-data";

const modeIcons: Record<Mode, typeof Zap> = { quick: Zap, notes: Pencil, exam: Target };
const modeIconStyles: Record<Mode, string> = {
  quick: "bg-sun text-foreground",
  notes: "bg-primary text-primary-foreground",
  exam: "bg-foreground text-background",
};

interface Props {
  fileName: string;
  mode: Mode;
  onSelect: (m: Mode) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export function ModeScreen({ fileName, mode, onSelect, onBack, onGenerate }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pb-8 pt-6">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground/50 transition-colors active:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        <h1 className="font-display text-2xl font-bold leading-tight">Choose a mode</h1>
        <p className="mt-1 text-sm text-foreground/50">How should we condense {fileName}?</p>

        <div className="mt-6 space-y-3">
          {MODES.map((m) => {
            const Icon = modeIcons[m.id];
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={`flex w-full items-start gap-3 rounded-3xl bg-card p-4 text-left shadow-sm transition-all active:scale-[0.99] ${
                  selected ? "ring-2 ring-primary" : "ring-1 ring-border"
                }`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${modeIconStyles[m.id]}`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold">{m.label}</span>
                  <span className="mt-0.5 block text-sm text-foreground/50">{m.blurb}</span>
                </span>
                {selected && (
                  <span className="pop-in mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 bg-background/90 px-5 pb-6 pt-3 backdrop-blur-sm">
        <button
          onClick={onGenerate}
          className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-[0.99]"
        >
          Generate summary
        </button>
      </div>
    </div>
  );
}
