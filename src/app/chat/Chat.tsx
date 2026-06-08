"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  "Bu oy nimaga ko'p pul ketdi?",
  "Eng katta xarajatim qaysi?",
  "Oy oxirigacha budjet yetadimi?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Javob olishda xatolik");
      setMessages([...next, { role: "model", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Javob olishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="mx-auto w-full min-h-0 max-w-3xl flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {empty && (
          <div className="mx-auto max-w-md pt-8 text-center">
            <p className="text-2xl">🤖</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              Pul — moliyaviy yordamchingiz
            </p>
            <p className="mt-1 text-sm text-muted">
              Xarajatlaringiz haqida savol bering.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-surface text-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl border border-border bg-surface px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <p className="rounded-2xl bg-[var(--negative-weak)] px-4 py-2 text-sm text-negative">
              {error}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Savol yozing..."
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Yuborish
          </button>
        </div>
      </div>
    </div>
  );
}
