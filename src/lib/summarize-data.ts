export type FileType = "PDF" | "PPTX" | "DOCX";
export type Mode = "quick" | "notes" | "exam";

export interface SummarySection {
  heading: string;
  text: string;
}
export interface QA {
  q: string;
  a: string;
}

export interface SummaryDoc {
  id: string;
  documentId: string;
  filename: string;
  title: string;
  type: FileType;
  mode: Mode;
  meta: string;
  when: string;
  tags: string[];
  status?: "processing" | "error";
  progress: number;
  error?: string;
  keyPoints: string[];
  terms: string[];
  sections: SummarySection[];
  qa?: QA[];
}

export interface UploadedDocument {
  id: string;
  filename: string;
  title: string;
  fileType: FileType;
  sizeBytes: number;
  unitCount: number;
  createdAt: string;
}

export interface ApiSummary {
  id: string;
  documentId: string;
  title: string;
  filename: string;
  fileType: FileType;
  sizeBytes: number;
  unitCount: number;
  mode: Mode;
  status: "processing" | "ready" | "error";
  progress: number;
  error: string | null;
  createdAt: string;
  payload: {
    title: string;
    tags: string[];
    key_points: string[];
    terms: string[];
    sections: SummarySection[];
    qa: QA[];
  } | null;
}

export const MODES: { id: Mode; label: string; blurb: string; short: string }[] = [
  {
    id: "quick",
    label: "Quick",
    blurb: "A 60-second gist of the whole document.",
    short: "60-sec gist",
  },
  {
    id: "notes",
    label: "Study Notes",
    blurb: "Structured sections, key points and key terms.",
    short: "Structured",
  },
  {
    id: "exam",
    label: "Exam Prep",
    blurb: "Flashcard-style Q&A and likely exam questions.",
    short: "Q & A",
  },
];

export const modeLabels: Record<Mode, string> = {
  quick: "Quick",
  notes: "Study Notes",
  exam: "Exam Prep",
};

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "Yesterday";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function unitLabel(type: FileType, count: number): string {
  if (type === "PDF") return `${count} ${count === 1 ? "page" : "pages"}`;
  if (type === "PPTX") return `${count} ${count === 1 ? "slide" : "slides"}`;
  return `${count} ${count === 1 ? "section" : "sections"}`;
}

export function toSummaryDoc(item: ApiSummary): SummaryDoc {
  const payload = item.payload;
  return {
    id: item.id,
    documentId: item.documentId,
    filename: item.filename,
    title: payload?.title || item.title,
    type: item.fileType,
    mode: item.mode,
    meta: `${item.filename} · ${unitLabel(item.fileType, item.unitCount)}`,
    when: relativeTime(item.createdAt),
    tags: payload?.tags ?? [],
    progress: item.progress,
    keyPoints: payload?.key_points ?? [],
    terms: payload?.terms ?? [],
    sections: payload?.sections ?? [],
    qa: payload?.qa ?? [],
    ...(item.status === "ready" ? {} : { status: item.status }),
    ...(item.error ? { error: item.error } : {}),
  };
}
