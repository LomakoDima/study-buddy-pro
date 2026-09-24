import { useState } from "react";
import { Check, ChevronLeft, Copy, Share2, Trash2 } from "lucide-react";
import type { SummaryDoc } from "@/lib/summarize-data";
import { ModeChip, SmallTypeBadge } from "./bits";

interface Props {
  doc: SummaryDoc;
  onDelete: () => Promise<void>;
  onBack: () => void;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-primary">
      {children}
    </h3>
  );
}

function summaryText(doc: SummaryDoc): string {
  const parts = [doc.title, "", ...doc.keyPoints.map((point) => `• ${point}`)];
  for (const section of doc.sections) parts.push("", section.heading, section.text);
  if (doc.qa?.length) for (const item of doc.qa) parts.push("", `Q: ${item.q}`, `A: ${item.a}`);
  return parts.join("\n");
}

export function SummaryScreen({ doc, onDelete, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(doc));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access is unavailable.");
    }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: doc.title, text: summaryText(doc) });
      else await copy();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("Sharing is unavailable on this device.");
    }
  };
  const remove = async () => {
    if (!window.confirm("Delete this summary? This cannot be undone.")) return;
    try {
      await onDelete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the summary");
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
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
          >
            {error}
          </p>
        )}
        <div className="mt-6 space-y-6">
          {doc.keyPoints.length > 0 && (
            <div>
              <SectionLabel>Key points</SectionLabel>
              <ul className="mt-2.5 space-y-2">
                {doc.keyPoints.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="flex gap-2.5 text-sm leading-relaxed text-foreground/80"
                  >
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-sun ring-2 ring-sun/30" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {doc.mode !== "quick" && doc.terms.length > 0 && (
            <div>
              <SectionLabel>Key terms</SectionLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {doc.terms.map((term, index) => (
                  <span
                    key={`${term}-${index}`}
                    className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground/70 shadow-sm ring-1 ring-border"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
          {doc.mode === "exam" && doc.qa && doc.qa.length > 0 && (
            <div>
              <SectionLabel>Likely questions</SectionLabel>
              <div className="mt-2.5 space-y-2.5">
                {doc.qa.map((item, index) => (
                  <div key={`${item.q}-${index}`} className="rounded-2xl bg-card p-4 shadow-sm">
                    <p className="text-sm font-bold">{item.q}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/65">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {doc.sections.map((section, index) => (
            <div key={`${section.heading}-${index}`}>
              <SectionLabel>{section.heading}</SectionLabel>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {section.text}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-5 pb-5 pt-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => void copy()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-background py-2.5 text-sm font-semibold text-foreground/80 ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            {copied ? (
              <Check className="size-4 text-primary" strokeWidth={3} />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => void share()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-background py-2.5 text-sm font-semibold text-foreground/80 ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            <Share2 className="size-4" /> Share
          </button>
          <button
            onClick={() => void remove()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground transition-all active:scale-[0.98]"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
