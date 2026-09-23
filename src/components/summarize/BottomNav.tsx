import { Home, LibraryBig, Plus } from "lucide-react";

interface Props {
  active: "home" | "library";
  onNavigate: (s: "home" | "library" | "upload") => void;
}

export function BottomNav({ active, onNavigate }: Props) {
  const item = (isActive: boolean) =>
    `flex flex-col items-center gap-1 transition-colors ${
      isActive ? "text-primary" : "text-foreground/35 active:text-foreground/60"
    }`;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-8 pb-5 pt-2.5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <button className={item(active === "home")} onClick={() => onNavigate("home")}>
          <Home className="size-5" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button
          onClick={() => onNavigate("upload")}
          className="-mt-9 grid size-14 place-items-center rounded-full bg-sun text-foreground shadow-lg shadow-sun/40 transition-transform active:scale-95"
          aria-label="Upload a document"
        >
          <Plus className="size-6" strokeWidth={2.75} />
        </button>
        <button className={item(active === "library")} onClick={() => onNavigate("library")}>
          <LibraryBig className="size-5" />
          <span className="text-[10px] font-bold">Library</span>
        </button>
      </div>
    </nav>
  );
}
