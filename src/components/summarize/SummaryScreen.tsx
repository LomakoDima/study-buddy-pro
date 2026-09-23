import { useState } from "react";
import { Bookmark, Check, ChevronLeft, Copy, Share2 } from "lucide-react";
import type { SummaryDoc } from "@/lib/summarize-data";
import { ModeChip, SmallTypeBadge } from "./bits";

interface Props {
  doc: SummaryDoc;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-primary">
      {children}
    </h3>
  );
}

export function SummaryScreen({ doc, saved, onToggleSave, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      const text = [doc.title, "", ...doc.keyPoints.map((k) => `• ${k}`)].join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — prototype only */
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pb-6 pt-6">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground/50 transition-colors active:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back
        </button>

        <div className="flex items-center gap-2.5">
          <SmallTypeBadge type={doc.type} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{doc.title}</p>
            <p className="text-[11px] text-foreground/50">{doc.meta}</p>
          </div>
          <ModeChip mode={doc.mode} />
        </div>

        <div className="mt-6 space-y-6">
          {doc.keyPoints.length > 0 && (
            <div>
              <SectionLabel>Key points</SectionLabel>
              <ul className="mt-2.5 space-y-2">
                {doc.keyPoints.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-foreground/80">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-sun ring-2 ring-sun/30" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {doc.mode !== "quick" && doc.terms.length > 0 && (
            <div>
              <SectionLabel>Key terms</SectionLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {doc.terms.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground/70 shadow-sm ring-1 ring-border"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {doc.mode === "exam" && doc.qa && doc.qa.length > 0 && (
            <div>
              <SectionLabel>Likely questions</SectionLabel>
              <div className="mt-2.5 space-y-2.5">
                {doc.qa.map((qa) => (
                  <div key={qa.q} className="rounded-2xl bg-card p-4 shadow-sm">
                    <p className="text-sm font-bold">{qa.q}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/65">{qa.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {doc.sections.map((s) => (
            <div key={s.heading}>
              <SectionLabel>{s.heading}</SectionLabel>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-5 pb-5 pt-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-background py-2.5 text-sm font-semibold text-foreground/80 ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            {copied ? (
              <Check className="size-4 text-primary" strokeWidth={3} />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-background py-2.5 text-sm font-semibold text-foreground/80 ring-1 ring-border transition-transform active:scale-[0.98]">
            <Share2 className="size-4" /> Share
          </button>
          <button
            onClick={onToggleSave}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.98] ${
              saved
                ? "bg-sun text-foreground"
                : "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            }`}
          >
            <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
