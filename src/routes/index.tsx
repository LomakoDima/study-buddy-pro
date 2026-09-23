import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MOCK_DOCS,
  NEW_DOC,
  type Mode,
  type SummaryDoc,
} from "@/lib/summarize-data";
import { BottomNav } from "@/components/summarize/BottomNav";
import { HomeScreen } from "@/components/summarize/HomeScreen";
import { LibraryScreen } from "@/components/summarize/LibraryScreen";
import { ModeScreen } from "@/components/summarize/ModeScreen";
import { ProcessingScreen } from "@/components/summarize/ProcessingScreen";
import { SummaryScreen } from "@/components/summarize/SummaryScreen";
import { UploadScreen } from "@/components/summarize/UploadScreen";

type Screen = "home" | "upload" | "mode" | "processing" | "summary" | "library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Summarize — Study notes from your lectures" },
      {
        name: "description",
        content:
          "Turn lecture PDFs, DOCX and PPTX files into short, structured study notes with Quick, Study Notes and Exam Prep modes.",
      },
      { property: "og:title", content: "Summarize — Study notes from your lectures" },
      {
        property: "og:description",
        content:
          "Upload a lecture file and get short, structured study notes. Quick, Study Notes or Exam Prep.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const UPLOADED_FILE = "BIO201_Lecture_07.pdf";

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [returnTo, setReturnTo] = useState<Screen>("home");
  const [docs, setDocs] = useState<SummaryDoc[]>(MOCK_DOCS);
  const [activeDoc, setActiveDoc] = useState<SummaryDoc | null>(null);
  const [mode, setMode] = useState<Mode>("notes");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const openDoc = (d: SummaryDoc) => {
    setActiveDoc(d);
    setReturnTo(screen === "library" ? "library" : "home");
    setScreen("summary");
  };

  const generate = () => {
    const doc: SummaryDoc = { ...NEW_DOC, id: `doc-${Date.now()}`, mode };
    setDocs((prev) => [doc, ...prev]);
    setActiveDoc(doc);
    setReturnTo("home");
    setScreen("processing");
  };

  const toggleSave = () => {
    if (!activeDoc) return;
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(activeDoc.id)) {
        next.delete(activeDoc.id);
      } else {
        next.add(activeDoc.id);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-background font-sans text-foreground antialiased">
      {screen === "home" && (
        <div key="home" className="screen-enter flex flex-1 flex-col">
          <HomeScreen
            docs={docs}
            mode={mode}
            onOpenDoc={openDoc}
            onUpload={() => setScreen("upload")}
            onSelectMode={(m) => {
              setMode(m);
              setScreen("upload");
            }}
            onLibrary={() => setScreen("library")}
          />
          <BottomNav active="home" onNavigate={(s) => setScreen(s)} />
        </div>
      )}

      {screen === "library" && (
        <div key="library" className="screen-enter flex flex-1 flex-col">
          <LibraryScreen docs={docs} onOpenDoc={openDoc} />
          <BottomNav active="library" onNavigate={(s) => setScreen(s)} />
        </div>
      )}

      {screen === "upload" && (
        <div key="upload" className="screen-enter flex flex-1 flex-col">
          <UploadScreen onBack={() => setScreen("home")} onContinue={() => setScreen("mode")} />
        </div>
      )}

      {screen === "mode" && (
        <div key="mode" className="screen-enter flex flex-1 flex-col">
          <ModeScreen
            fileName={UPLOADED_FILE}
            mode={mode}
            onSelect={setMode}
            onBack={() => setScreen("upload")}
            onGenerate={generate}
          />
        </div>
      )}

      {screen === "processing" && (
        <div key="processing" className="screen-enter flex flex-1 flex-col">
          <ProcessingScreen
            fileName={UPLOADED_FILE}
            mode={mode}
            onDone={() => setScreen("summary")}
          />
        </div>
      )}

      {screen === "summary" && activeDoc && (
        <div key="summary" className="screen-enter flex flex-1 flex-col">
          <SummaryScreen
            doc={activeDoc}
            saved={savedIds.has(activeDoc.id)}
            onToggleSave={toggleSave}
            onBack={() => setScreen(returnTo)}
          />
        </div>
      )}
    </div>
  );
}
