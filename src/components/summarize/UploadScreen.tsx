import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, FileText, Upload } from "lucide-react";

type Phase = "idle" | "uploading" | "ready";

interface Props {
  onBack: () => void;
  onContinue: () => void;
}

export function UploadScreen({ onBack, onContinue }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const pick = () => {
    if (phase !== "idle") return;
    setPhase("uploading");
    timer.current = window.setTimeout(() => setPhase("ready"), 1900);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pb-8 pt-6">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground/50 transition-colors active:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        <h1 className="font-display text-2xl font-bold leading-tight">Upload a document</h1>
        <p className="mt-1 text-sm text-foreground/50">
          Pick a file to turn into structured notes.
        </p>

        <button
          onClick={pick}
          className="mt-6 w-full rounded-3xl bg-card p-5 text-left shadow-sm ring-1 ring-border transition-transform active:scale-[0.99]"
        >
          {phase === "idle" ? (
            <div className="grid place-items-center rounded-2xl border-2 border-dashed border-input py-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-5" />
              </span>
              <p className="mt-3 text-sm font-bold">Tap to choose a file</p>
              <p className="mt-1 text-xs text-foreground/45">PDF · DOCX · PPTX — up to 20 MB</p>
            </div>
          ) : (
            <div className="pop-in flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">BIO201_Lecture_07.pdf</p>
                <p className="mt-0.5 text-xs text-foreground/50">4.2 MB</p>
                {phase === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="animate-indeterminate h-full w-1/3 rounded-full bg-primary" />
                  </div>
                )}
              </div>
              {phase === "uploading" ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground/50">
                  Uploading
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  <Check className="size-3.5" strokeWidth={3} /> Ready
                </span>
              )}
            </div>
          )}
        </button>

        <p className="mt-4 px-1 text-center text-xs text-foreground/40">
          Only PDF, DOCX and PPTX files are supported.
        </p>
      </div>

      <div className="sticky bottom-0 bg-background/90 px-5 pb-6 pt-3 backdrop-blur-sm">
        <button
          disabled={phase !== "ready"}
          onClick={onContinue}
          className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-[0.99] disabled:bg-muted disabled:text-foreground/40 disabled:shadow-none"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
