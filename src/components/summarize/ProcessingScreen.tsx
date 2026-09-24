import { useEffect, useState } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { modeLabels, toSummaryDoc, type Mode, type SummaryDoc } from "@/lib/summarize-data";

interface Props {
  summaryId: string;
  fileName: string;
  mode: Mode;
  onDone: (doc: SummaryDoc) => void;
  onBack: () => void;
}

export function ProcessingScreen({ summaryId, fileName, mode, onDone, onBack }: Props) {
  const [progress, setProgress] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const summary = await api.getSummary(summaryId);
        if (cancelled) return;
        setProgress(summary.progress);
        if (summary.status === "ready") {
          onDone(toSummaryDoc(summary));
          return;
        }
        if (summary.status === "error") {
          setError(summary.error || "Summary generation failed. Please try again.");
          return;
        }
        timer = window.setTimeout(() => void poll(), 900);
      } catch (reason) {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Could not check summary progress");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [onDone, summaryId]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 rounded-full border border-primary/20" />
        {!error && (
          <span className="animate-spin-slow absolute inset-0 rounded-full border-2 border-transparent border-t-primary" />
        )}
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
      </div>
      <h2 className="mt-6 font-display text-xl font-bold">
        {error ? "Couldn’t create the summary" : "Summarizing your notes"}
      </h2>
      <p className={`mt-1 max-w-xs text-sm ${error ? "text-destructive" : "text-foreground/50"}`}>
        {error || `Reading ${fileName} · ${modeLabels[mode]}`}
      </p>
      {!error && (
        <>
          <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-foreground/40">{progress}%</p>
        </>
      )}
      {error && (
        <button
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1 rounded-xl bg-card px-4 py-2.5 text-sm font-bold ring-1 ring-border"
        >
          <ChevronLeft className="size-4" /> Back home
        </button>
      )}
    </div>
  );
}
