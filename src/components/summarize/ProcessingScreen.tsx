import { useEffect } from "react";
import { FileText } from "lucide-react";
import { modeLabels, type Mode } from "@/lib/summarize-data";

interface Props {
  fileName: string;
  mode: Mode;
  onDone: () => void;
}

export function ProcessingScreen({ fileName, mode, onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 rounded-full border border-primary/20" />
        <span className="animate-spin-slow absolute inset-0 rounded-full border-2 border-transparent border-t-primary" />
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
      </div>
      <h2 className="mt-6 font-display text-xl font-bold">Summarizing your notes</h2>
      <p className="mt-1 text-sm text-foreground/50">
        Reading {fileName} · {modeLabels[mode]}
      </p>
      <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="animate-indeterminate h-full w-1/2 rounded-full bg-primary" />
      </div>
    </div>
  );
}
