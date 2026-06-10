"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category, toCategory } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import { todayYmd, ymdDaysAgo } from "@/lib/dates";

type VoiceItem = {
  note: string;
  amount: number;
  category: Category;
  // YYYY-MM-DD (Tashkent); defaults to today but can be backdated ("kecha …").
  date: string;
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

// Gemini accepts WAV but not the webm/mp4 containers most browsers record, so
// we transcode the recording client-side before sending.
const TARGET_SAMPLE_RATE = 16000;

// Resolve the (possibly webkit-prefixed) Web Audio constructors.
function getAudioContextCtor(): typeof AudioContext {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  );
}

function getOfflineAudioContextCtor(): typeof OfflineAudioContext {
  return (
    window.OfflineAudioContext ??
    (
      window as unknown as {
        webkitOfflineAudioContext: typeof OfflineAudioContext;
      }
    ).webkitOfflineAudioContext
  );
}

// Encode mono Float32 PCM samples as a 16-bit little-endian WAV blob with a
// standard 44-byte RIFF/WAVE header.
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // file size minus 8
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size (PCM)
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = 1 (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate (mono)
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Clamp float [-1, 1] and write as signed 16-bit little-endian.
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// Decode a recorded audio Blob, downmix to mono, resample to 16 kHz, and
// return it as a WAV blob. Throws if the audio can't be decoded.
async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  // decodeAudioData gives us PCM (resampled to the context's own rate).
  const decodeCtx = new (getAudioContextCtor())();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    void decodeCtx.close();
  }

  // Clean downmix + resample to 16 kHz mono via an OfflineAudioContext.
  const length = Math.max(
    1,
    Math.ceil((decoded.length * TARGET_SAMPLE_RATE) / decoded.sampleRate),
  );
  const offline = new (getOfflineAudioContextCtor())(
    1,
    length,
    TARGET_SAMPLE_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
}

export default function VoiceExpense() {
  const router = useRouter();
  const today = todayYmd();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      // Transcode the browser's webm/mp4 recording to 16 kHz mono WAV, which
      // Gemini accepts on every browser.
      let wav: Blob;
      try {
        wav = await blobToWav(blob);
      } catch (convErr) {
        console.error("Voice WAV conversion failed:", convErr);
        setError("Tushunmadim, qaytadan urinib ko'ring.");
        return;
      }

      const audioBase64 = await blobToBase64(wav);
      const res = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/wav" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Tushunmadim");

      const parsed: VoiceItem[] = Array.isArray(data.expenses)
        ? data.expenses.map((it: VoiceItem & { daysAgo?: number }) => ({
            note: it.note,
            amount: it.amount,
            category: toCategory(it.category),
            date: ymdDaysAgo(Number(it.daysAgo) || 0),
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
          expenses: items.map(({ note, amount, category, date }) => ({
            note,
            amount,
            category,
            date,
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

                {/* Date — defaults to today; allows logging a forgotten
                    expense on an earlier day. Future dates are blocked. */}
                <input
                  type="date"
                  max={today}
                  value={item.date}
                  onChange={(e) =>
                    updateItem(i, { date: e.target.value || today })
                  }
                  className="input"
                  style={{ width: "auto", padding: "8px 11px" }}
                  title="Sana"
                />

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
