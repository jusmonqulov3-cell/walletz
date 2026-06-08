"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/LanguageProvider";

// Client-side view of a proposed action: we only display its summary and post
// the whole object back to /api/chat/action, so it can stay opaque here.
type ProposedAction = { type: string; summary: string; [key: string]: unknown };
type ActionState = "pending" | "running" | "done" | "cancelled" | "error";
type ActionItem = { action: ProposedAction; state: ActionState };

type Message = { role: "user" | "model"; text: string; actions?: ActionItem[] };

export default function Chat() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Restore the persisted conversation on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/history");
        if (res.ok) {
          const data = await res.json();
          if (
            !cancelled &&
            Array.isArray(data.messages) &&
            data.messages.length
          ) {
            setMessages(
              data.messages.map((m: { role: "user" | "model"; text: string }) => ({
                role: m.role,
                text: m.text,
              })),
            );
          }
        }
      } catch {
        // Offline / not signed in — start fresh.
      }
      if (!cancelled) setHistoryLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        // Send only role/text — the server doesn't need the action UI state.
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t.chat.error);
      const actions: ActionItem[] = Array.isArray(data.actions)
        ? data.actions.map((a: ProposedAction) => ({
            action: a,
            state: "pending" as const,
          }))
        : [];
      setMessages([
        ...next,
        { role: "model", text: data.reply ?? "", actions },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chat.error);
    } finally {
      setLoading(false);
    }
  }

  function setActionState(mi: number, ai: number, state: ActionState) {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== mi || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map((it, j) =>
            j === ai ? { ...it, state } : it,
          ),
        };
      }),
    );
  }

  async function runAction(mi: number, ai: number, action: ProposedAction) {
    setActionState(mi, ai, "running");
    try {
      const res = await fetch("/api/chat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      setActionState(mi, ai, "done");
    } catch {
      setActionState(mi, ai, "error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const empty = historyLoaded && messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="mx-auto w-full min-h-0 max-w-3xl flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {empty && (
          <div className="mx-auto max-w-md pt-8 text-center">
            <p className="text-2xl">🤖</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t.chat.title}
            </p>
            <p className="mt-1 text-sm text-muted">{t.chat.subtitle}</p>
            <div className="mt-5 flex flex-col gap-2">
              {t.chat.suggestions.map((s) => (
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
          <div key={i} className="space-y-2">
            <div
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.text && (
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              )}
            </div>

            {/* Proposed-action confirm cards (model turns only). */}
            {m.actions?.map((it, j) => (
              <div key={j} className="flex justify-start">
                <div className="w-[80%] max-w-md rounded-2xl border border-border bg-surface px-4 py-3">
                  <p className="text-sm text-foreground">{it.action.summary}</p>

                  {it.state === "pending" && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => runAction(i, j, it.action)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-foreground transition hover:bg-[var(--accent-strong)]"
                      >
                        {t.chat.confirm}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionState(i, j, "cancelled")}
                        className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition hover:bg-[var(--subtle)]"
                      >
                        {t.chat.cancel}
                      </button>
                    </div>
                  )}

                  {it.state === "running" && (
                    <p className="mt-2 text-[13px] text-muted">…</p>
                  )}
                  {it.state === "done" && (
                    <p className="mt-2 text-[13px] font-medium text-positive">
                      ✅ {t.chat.done}
                    </p>
                  )}
                  {it.state === "cancelled" && (
                    <p className="mt-2 text-[13px] text-muted">
                      {t.chat.cancelled}
                    </p>
                  )}
                  {it.state === "error" && (
                    <p className="mt-2 text-[13px] font-medium text-negative">
                      {t.chat.failed}
                    </p>
                  )}
                </div>
              </div>
            ))}
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
            placeholder={t.chat.placeholder}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.chat.send}
          </button>
        </div>
      </div>
    </div>
  );
}
