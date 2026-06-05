"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category, toCategory } from "@/lib/categories";
import { formatAmount } from "@/lib/format";

type VoiceItem = {
  note: string;
  amount: number;
  category: Category;
  confidence: number;
};

// Recording format preference: the codec we ask MediaRecorder to capture, and
// the base MIME we send to Gemini for each.
const FORMATS: { record: string; send: string }[] = [
  { record: "audio/ogg;codecs=opus", send: "audio/ogg" },
  { record: "audio/mp4", send: "audio/mp4" },
  { record: "audio/webm;codecs=opus", send: "audio/webm" },
];

function pickFormat(): { record: string; send: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const f of FORMATS) {
    if (MediaRecorder.isTypeSupported(f.record)) return f;
  }
  return null;
}

// Read a Blob as base64 (no data: URI prefix).
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Ovozni o'qib bo'lmadi"));
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

export default function VoiceExpense() {
  const router = useRouter();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendMimeRef = useRef<string>("audio/webm");

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<string | null>(null);
  const [items, setItems] = useState<VoiceItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function startRecording() {
    if (recording || transcribing) return;
    setError(null);
    setSaveError(null);

    const format = pickFormat();
    if (!format) {
      setError("Brauzeringiz ovoz yozishni qo'llab-quvvatlamaydi.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.",
      );
      return;
    }

    sendMimeRef.current = format.send;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType: format.record });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      // Release the mic.
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: format.record });
      void transcribe(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    // Fresh take: clear any previous result.
    setTranscript(null);
    setItems([]);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: sendMimeRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Tushunmadim");

      const parsed: VoiceItem[] = Array.isArray(data.expenses)
        ? data.expenses.map((it: VoiceItem) => ({
            note: it.note,
            amount: it.amount,
            category: toCategory(it.category),
            confidence: it.confidence,
          }))
        : [];

      if (parsed.length === 0) {
        setError("Tushunmadim, qaytadan urinib ko'ring.");
        return;
      }

      setTranscript(
        typeof data.transcript === "string" ? data.transcript : null,
      );
      setItems(parsed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Tushunmadim, qaytadan urinib ko'ring.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  function updateItem(index: number, patch: Partial<VoiceItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const itemsTotal = items.reduce((sum, it) => sum + (it.amount || 0), 0);

  async function handleSave() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenses: items.map(({ note, amount, category }) => ({
            note,
            amount,
            category,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Saqlashda xatolik");
      setTranscript(null);
      setItems([]);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Controls */}
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="btn"
          style={{ background: "var(--negative)" }}
        >
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          Yozilmoqda… To&apos;xtatish
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={transcribing}
          className="btn ghost"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          {transcribing ? "Eshitilmoqda..." : "Ovozli kiritish"}
        </button>
      )}

      {error && (
        <p className="mt-3 text-[12.5px] font-medium text-negative">{error}</p>
      )}

      {/* Editable preview */}
      {items.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          {transcript && (
            <p className="mb-3 rounded-[10px] bg-[var(--subtle)] px-3 py-2 text-[13px] text-muted">
              Eshitilgan: {transcript}
            </p>
          )}

          <div className="field-label" style={{ margin: "0 0 9px" }}>
            Tasdiqlang ({items.length})
          </div>
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(i, { note: e.target.value })}
                    className="input min-w-0 flex-1"
                    style={{ padding: "8px 11px" }}
                  />
                  {item.confidence < 0.6 && (
                    <span
                      className="badge-pill shrink-0"
                      style={{ background: "var(--warn-weak)", color: "var(--warn)" }}
                    >
                      tekshiring
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={item.amount}
                  onChange={(e) =>
                    updateItem(i, { amount: Number(e.target.value) || 0 })
                  }
                  className="input mono w-28 text-right"
                  style={{ padding: "8px 11px" }}
                />

                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(i, { category: e.target.value as Category })
                  }
                  className="input"
                  style={{ width: "auto", padding: "8px 28px 8px 11px" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label="O'chirish"
                  className="shrink-0 rounded-md px-2 py-1 text-muted transition hover:bg-[var(--subtle)] hover:text-foreground"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {saveError && (
            <p className="mt-3 text-[12.5px] font-medium text-negative">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-muted">
              Jami:{" "}
              <span className="mono font-semibold text-foreground">
                {formatAmount(itemsTotal)}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
