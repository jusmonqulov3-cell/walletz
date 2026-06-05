"use client";

import { useState } from "react";
import QuickExpense from "./QuickExpense";
import ReceiptScanner from "./ReceiptScanner";
import VoiceExpense from "./VoiceExpense";

type Tab = "text" | "receipt" | "voice";

const TABS: { id: Tab; label: string }[] = [
  { id: "text", label: "✍️ Matn" },
  { id: "receipt", label: "📷 Rasm" },
  { id: "voice", label: "🎤 Ovoz" },
];

export default function ExpenseInput() {
  const [tab, setTab] = useState<Tab>("text");

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-700">Xarajat qo&apos;shish</h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Each input mode keeps its own state; we mount only the active one.
          Behavior and the shared preview/save flow are unchanged. */}
      {tab === "text" && <QuickExpense />}
      {tab === "receipt" && <ReceiptScanner />}
      {tab === "voice" && <VoiceExpense />}
    </section>
  );
}
