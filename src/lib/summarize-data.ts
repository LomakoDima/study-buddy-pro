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
  title: string;
  type: FileType;
  mode: Mode;
  meta: string;
  when: string;
  tags: string[];
  status?: "processing";
  keyPoints: string[];
  terms: string[];
  sections: SummarySection[];
  qa?: QA[];
}

export const MODES: { id: Mode; label: string; blurb: string; short: string }[] = [
  { id: "quick", label: "Quick", blurb: "A 60-second gist of the whole document.", short: "60-sec gist" },
  { id: "notes", label: "Study Notes", blurb: "Structured sections, key points and key terms.", short: "Structured" },
  { id: "exam", label: "Exam Prep", blurb: "Flashcard-style Q&A and likely exam questions.", short: "Q & A" },
];

export const modeLabels: Record<Mode, string> = {
  quick: "Quick",
  notes: "Study Notes",
  exam: "Exam Prep",
};

export const MOCK_DOCS: SummaryDoc[] = [
  {
    id: "doc-cogpsy",
    title: "Cognitive Psychology · Ch.4",
    type: "PDF",
    mode: "quick",
    meta: "12 pages · 2 min read",
    when: "2h ago",
    tags: ["Memory", "Attention", "Recall"],
    keyPoints: [
      "Working memory holds about 4 chunks at once",
      "Attention filters information before it reaches memory",
      "Spacing beats cramming for long-term recall",
      "Retrieval practice strengthens memory more than rereading",
      "Interleaving similar topics improves discrimination",
    ],
    terms: ["Chunking", "Encoding", "Recall"],
    sections: [
      {
        heading: "In one line",
        text: "Chapter 4 explains how attention selects information, how working memory stores it in chunks, and why retrieval practice outperforms passive review.",
      },
    ],
  },
  {
    id: "doc-micro",
    title: "Microeconomics · Supply & Demand",
    type: "PPTX",
    mode: "exam",
    meta: "28 slides · 5 min read",
    when: "Yesterday",
    tags: ["Elasticity", "Equilibrium"],
    keyPoints: [
      "Demand curves slope downward; supply curves slope upward",
      "Equilibrium is where quantity demanded equals quantity supplied",
      "Price ceilings cause shortages; floors cause surpluses",
    ],
    terms: ["Elasticity", "Equilibrium", "Surplus"],
    sections: [
      {
        heading: "Core model",
        text: "Markets clear at the intersection of supply and demand. Prices above equilibrium create surpluses; prices below create shortages — both push the price back.",
      },
    ],
    qa: [
      {
        q: "What shifts the demand curve?",
        a: "Income, tastes, prices of related goods, expectations and the number of buyers — anything except the good's own price.",
      },
      {
        q: "What is price elasticity of demand?",
        a: "The percentage change in quantity demanded divided by the percentage change in price. Above 1 means elastic.",
      },
      {
        q: "When is a market in equilibrium?",
        a: "When quantity supplied equals quantity demanded at the current price, so there is no pressure for the price to change.",
      },
    ],
  },
  {
    id: "doc-ochem",
    title: "Organic Chemistry · Lab Report",
    type: "DOCX",
    mode: "notes",
    meta: "8 pages · 4 min read",
    when: "3 days ago",
    tags: ["Titration", "pH", "Molarity"],
    keyPoints: [
      "Titration measures unknown concentration using a standard solution",
      "The equivalence point is signaled by an indicator color change",
      "pH probes are more precise than indicators",
      "Rinse the burette with the titrant before filling",
      "Record volumes to 0.01 mL precision",
    ],
    terms: ["Titration", "pH", "Molarity", "Equivalence point"],
    sections: [
      {
        heading: "Procedure",
        text: "Prepare the standard solution, fill the burette, add indicator to the analyte and dispense titrant until the endpoint. Repeat for consistency and average the volumes.",
      },
      {
        heading: "Calculations",
        text: "Use M1V1 = M2V2 at the equivalence point to solve for the unknown concentration, accounting for stoichiometric ratios.",
      },
    ],
  },
  {
    id: "doc-thermo",
    title: "Thermodynamics — Lecture 4",
    type: "PDF",
    mode: "notes",
    meta: "14 pages · 3 min read",
    when: "Tuesday",
    tags: ["Enthalpy", "Entropy"],
    keyPoints: [
      "Energy is conserved; it changes form but never disappears",
      "ΔU = Q − W ties internal energy to heat and work",
      "Adiabatic processes exchange no heat, only work",
      "Isothermal processes keep temperature constant",
    ],
    terms: ["Enthalpy", "Entropy", "Isobaric", "Cyclic"],
    sections: [
      {
        heading: "Heat engines",
        text: "A heat engine converts thermal energy into mechanical work. Efficiency is bounded by the temperatures of the hot and cold reservoirs — a limit no real engine can exceed.",
      },
    ],
  },
  {
    id: "doc-coldwar",
    title: "World History · The Cold War",
    type: "PDF",
    mode: "quick",
    meta: "22 pages · 4 min read",
    when: "Monday",
    tags: ["Containment", "Détente"],
    keyPoints: [
      "The Cold War was a standoff, not direct war, between the US and USSR",
      "Containment shaped Western foreign policy from 1947",
      "Berlin and Cuba brought the rivals closest to open conflict",
      "The arms race defined decades of spending and fear",
      "It ended with Soviet reform and collapse, 1989–1991",
    ],
    terms: ["Containment", "Détente", "Iron Curtain"],
    sections: [
      {
        heading: "In one line",
        text: "Ideological rivalry between two superpowers, fought through proxies, propaganda and an arms race rather than direct battle.",
      },
    ],
  },
  {
    id: "doc-cellbio",
    title: "Cell Biology · Slides",
    type: "PPTX",
    mode: "exam",
    meta: "31 slides · 6 min read",
    when: "Sunday",
    tags: ["Organelles", "Membranes"],
    status: "processing",
    keyPoints: [],
    terms: [],
    sections: [],
  },
];

export const NEW_DOC: SummaryDoc = {
  id: "doc-neuro",
  title: "Neuroscience · Synaptic Transmission",
  type: "PDF",
  mode: "notes",
  meta: "BIO201_Lecture_07.pdf · 9 pages · 3 min read",
  when: "Just now",
  tags: ["Synapse", "Neurotransmitters"],
  keyPoints: [
    "Neurons communicate across synapses using chemical neurotransmitters",
    "Action potentials reach the axon terminal and trigger Ca²⁺ influx",
    "Vesicles fuse with the membrane and release transmitter into the cleft",
    "Receptors on the postsynaptic cell open ion channels",
    "Reuptake and enzymes clear the cleft for the next signal",
  ],
  terms: ["Synapse", "Neurotransmitter", "Reuptake", "Action potential"],
  sections: [
    {
      heading: "Overview",
      text: "Synaptic transmission converts an electrical signal into a chemical one and back. The presynaptic terminal releases transmitter, which binds receptors and changes the postsynaptic cell's voltage.",
    },
    {
      heading: "Why it matters",
      text: "Most drugs that affect mood and learning act on this step — by changing release, receptor binding or reuptake.",
    },
  ],
};
