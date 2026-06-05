"use client";

import { useState } from "react";
import QuickExpense from "./QuickExpense";
import ReceiptScanner from "./ReceiptScanner";
import VoiceExpense from "./VoiceExpense";

type Tab = "text" | "receipt" | "voice";

const TABS: { id: Tab; label: string }[] = [
  { id: "text", label: "Matn" },
  { id: "receipt", label: "Rasm" },
  { id: "voice", label: "Ovoz" },
];

export default function ExpenseInput() {
  const [tab, setTab] = useState<Tab>("text");

  return (
    <div className="card card-pad">
      <div className="seg">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Each input mode keeps its own state; we mount only the active one.
          Behavior and the shared preview/save flow are unchanged. */}
      <div className="mt-3.5">
        {tab === "text" && <QuickExpense />}
        {tab === "receipt" && <ReceiptScanner />}
        {tab === "voice" && <VoiceExpense />}
      </div>
    </div>
  );
}
