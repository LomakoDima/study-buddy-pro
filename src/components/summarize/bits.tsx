import { modeLabels, type FileType, type Mode } from "@/lib/summarize-data";

const typeStyles: Record<FileType, string> = {
  PDF: "bg-primary/10 text-primary",
  PPTX: "bg-foreground/10 text-foreground",
  DOCX: "bg-sun/40 text-foreground",
};

const typeShort: Record<FileType, string> = {
  PDF: "PDF",
  PPTX: "PPT",
  DOCX: "DOC",
};

export function TypeBadge({ type }: { type: FileType }) {
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-2xl text-[11px] font-bold ${typeStyles[type]}`}
    >
      {typeShort[type]}
    </span>
  );
}

export function SmallTypeBadge({ type }: { type: FileType }) {
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-xl text-[9px] font-bold ${typeStyles[type]}`}
    >
      {typeShort[type]}
    </span>
  );
}

const modeStyles: Record<Mode, string> = {
  quick: "bg-sun text-foreground",
  notes: "bg-foreground text-background",
  exam: "bg-primary text-primary-foreground",
};

export function ModeChip({ mode }: { mode: Mode }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${modeStyles[mode]}`}
    >
      {modeLabels[mode]}
    </span>
  );
}
