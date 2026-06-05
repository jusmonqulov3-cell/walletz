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
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Controls */}
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          Yozilmoqda… To&apos;xtatish
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={transcribing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {transcribing ? "Eshitilmoqda..." : "🎤 Ovozli kiritish"}
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Editable preview */}
      {items.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          {transcript && (
            <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Eshitilgan: {transcript}
            </p>
          )}

          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Tasdiqlang ({items.length})
          </h3>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={item.note}
                    onChange={(e) => updateItem(i, { note: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                  />
                  {item.confidence < 0.6 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
                  className="w-28 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-gray-900"
                />

                <select
                  value={item.category}
                  onChange={(e) =>
                    updateItem(i, { category: e.target.value as Category })
                  }
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
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
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {saveError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {saveError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Jami:{" "}
              <span className="font-medium text-gray-900">
                {formatAmount(itemsTotal)}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
