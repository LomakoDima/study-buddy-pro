import { useRef, useState, type ChangeEvent } from "react";
import { Check, ChevronLeft, FileText, Upload } from "lucide-react";

type Phase = "idle" | "uploading" | "ready";

const MAX_FILE_MB = Number(import.meta.env["VITE_MAX_FILE_MB"] || (import.meta.env.PROD ? 4 : 20));

interface Props {
  onBack: () => void;
  onUpload: (file: File, onProgress: (progress: number) => void) => Promise<void>;
  onContinue: () => void;
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadScreen({ onBack, onUpload, onContinue }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = () => {
    if (phase !== "uploading") input.current?.click();
  };

  const selected = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    if (nextFile.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null);
      setError(`This file is too large. The limit is ${MAX_FILE_MB} MB.`);
      setPhase("idle");
      return;
    }
    setFile(nextFile);
    setError(null);
    setProgress(0);
    setPhase("uploading");
    try {
      await onUpload(nextFile, setProgress);
      setProgress(100);
      setPhase("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed");
      setPhase("idle");
    }
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

        <input
          ref={input}
          className="hidden"
          type="file"
          accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(event) => void selected(event)}
        />
        <button
          onClick={choose}
          disabled={phase === "uploading"}
          className="mt-6 w-full rounded-3xl bg-card p-5 text-left shadow-sm ring-1 ring-border transition-transform active:scale-[0.99] disabled:cursor-wait"
        >
          {!file || (phase === "idle" && error) ? (
            <div className="grid place-items-center rounded-2xl border-2 border-dashed border-input py-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-5" />
              </span>
              <p className="mt-3 text-sm font-bold">Tap to choose a file</p>
              <p className="mt-1 text-xs text-foreground/45">
                PDF · DOCX · PPTX — up to {MAX_FILE_MB} MB
              </p>
            </div>
          ) : (
            <div className="pop-in flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{file.name}</p>
                <p className="mt-0.5 text-xs text-foreground/50">{fileSize(file.size)}</p>
                {phase === "uploading" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>
                )}
              </div>
              {phase === "uploading" ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground/50">
                  {progress ? `${progress}%` : "Reading"}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  <Check className="size-3.5" strokeWidth={3} /> Ready
                </span>
              )}
            </div>
          )}
        </button>
        {error ? (
          <p role="alert" className="mt-4 px-1 text-center text-xs font-semibold text-destructive">
            {error}
          </p>
        ) : (
          <p className="mt-4 px-1 text-center text-xs text-foreground/40">
            Only PDF, DOCX and PPTX files are supported.
          </p>
        )}
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
