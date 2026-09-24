import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { initializeTelegramMiniApp } from "@/lib/telegram";
import {
  toSummaryDoc,
  type Mode,
  type SummaryDoc,
  type UploadedDocument,
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
        content: "Turn lecture PDFs, DOCX and PPTX files into short, structured study notes.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [returnTo, setReturnTo] = useState<Screen>("home");
  const [docs, setDocs] = useState<SummaryDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<SummaryDoc | null>(null);
  const [uploaded, setUploaded] = useState<UploadedDocument | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("notes");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [, summaries] = await Promise.all([api.me(), api.listSummaries()]);
      setDocs(summaries.map(toSummaryDoc));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your summaries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await initializeTelegramMiniApp();
        if (!cancelled) await loadLibrary();
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not initialize the app");
          setLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [loadLibrary]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const openDoc = (doc: SummaryDoc) => {
    if (doc.status) return;
    setActiveDoc(doc);
    setReturnTo(screen === "library" ? "library" : "home");
    setScreen("summary");
  };

  const generate = async () => {
    if (!uploaded) return;
    setLoadError(null);
    setGenerating(true);
    try {
      const created = await api.createSummary(uploaded.id, mode);
      const doc = toSummaryDoc(created);
      setDocs((previous) => [doc, ...previous]);
      setProcessingId(created.id);
      setScreen("processing");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not start the summary");
    } finally {
      setGenerating(false);
    }
  };

  const finishProcessing = (doc: SummaryDoc) => {
    setDocs((previous) => previous.map((item) => (item.id === doc.id ? doc : item)));
    setActiveDoc(doc);
    setReturnTo("home");
    setScreen("summary");
  };

  const deleteActive = async () => {
    if (!activeDoc) return;
    await api.deleteSummary(activeDoc.id);
    setDocs((previous) => previous.filter((item) => item.id !== activeDoc.id));
    setActiveDoc(null);
    setScreen(returnTo === "summary" ? "home" : returnTo);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-background font-sans text-foreground antialiased">
      {screen === "home" && (
        <div key="home" className="screen-enter flex flex-1 flex-col">
          <HomeScreen
            docs={docs}
            loading={loading}
            error={loadError}
            onRetry={loadLibrary}
            onOpenDoc={openDoc}
            onUpload={() => setScreen("upload")}
            onLibrary={() => setScreen("library")}
          />
          <BottomNav active="home" onNavigate={(next) => setScreen(next)} />
        </div>
      )}
      {screen === "library" && (
        <div key="library" className="screen-enter flex flex-1 flex-col">
          <LibraryScreen docs={docs} loading={loading} onOpenDoc={openDoc} />
          <BottomNav active="library" onNavigate={(next) => setScreen(next)} />
        </div>
      )}
      {screen === "upload" && (
        <div key="upload" className="screen-enter flex flex-1 flex-col">
          <UploadScreen
            onBack={() => setScreen("home")}
            onUpload={async (file, onProgress) => {
              const result = await api.uploadDocument(file, onProgress);
              setUploaded(result);
            }}
            onContinue={() => setScreen("mode")}
          />
        </div>
      )}
      {screen === "mode" && uploaded && (
        <div key="mode" className="screen-enter flex flex-1 flex-col">
          <ModeScreen
            fileName={uploaded.filename}
            mode={mode}
            onSelect={setMode}
            onBack={() => setScreen("upload")}
            onGenerate={() => void generate()}
            error={loadError}
            generating={generating}
          />
        </div>
      )}
      {screen === "processing" && processingId && uploaded && (
        <div key="processing" className="screen-enter flex flex-1 flex-col">
          <ProcessingScreen
            summaryId={processingId}
            fileName={uploaded.filename}
            mode={mode}
            onDone={finishProcessing}
            onBack={() => {
              void loadLibrary();
              setScreen("home");
            }}
          />
        </div>
      )}
      {screen === "summary" && activeDoc && (
        <div key="summary" className="screen-enter flex flex-1 flex-col">
          <SummaryScreen
            doc={activeDoc}
            onDelete={deleteActive}
            onBack={() => setScreen(returnTo)}
          />
        </div>
      )}
    </div>
  );
}
