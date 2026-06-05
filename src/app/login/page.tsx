"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is disabled, a session is returned immediately.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setMessage(
          "Ro'yxatdan o'tish muvaffaqiyatli. Emailingizni tasdiqlang.",
        );
        setLoading(false);
      }
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-foreground"
          >
            P
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            PulNazorat
          </h1>
          <p className="mt-1 text-sm text-muted">Shaxsiy moliya yordamchingiz</p>
        </div>

        <Card className="p-6">
          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isLogin
                  ? "bg-surface text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Kirish
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setMessage(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                !isLogin
                  ? "bg-surface text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Ro&apos;yxatdan o&apos;tish
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siz@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Parol
              </label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-negative/20 bg-negative/10 px-3 py-2 text-sm text-negative">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg border border-positive/20 bg-positive/10 px-3 py-2 text-sm text-positive">
                {message}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Yuklanmoqda..."
                : isLogin
                  ? "Kirish"
                  : "Ro'yxatdan o'tish"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
