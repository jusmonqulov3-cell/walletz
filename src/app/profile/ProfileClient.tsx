"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { signOut } from "@/app/auth/actions";

type Status = { kind: "ok" | "err"; text: string } | null;

// Show/hide toggle button pinned to the right edge of a password input.
function EyeToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Parolni yashirish" : "Parolni ko'rsatish"}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-foreground"
    >
      {shown ? (
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
        >
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M6.61 6.61A18.45 18.45 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <path d="M2 2l20 20" />
        </svg>
      ) : (
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
        >
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function ProfileClient({
  email,
  name,
  createdAt,
  telegramUsername,
  telegramNotify,
}: {
  email: string;
  name: string;
  createdAt: string | null;
  telegramUsername: string | null;
  telegramNotify: boolean;
}) {
  const router = useRouter();

  // --- Change display name ---
  const [displayName, setDisplayName] = useState(name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameStatus, setNameStatus] = useState<Status>(null);

  // --- Change email ---
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState<Status>(null);

  // --- Change password ---
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState<Status>(null);

  // --- Restart (wipe all activity data) ---
  const [confirming, setConfirming] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetStatus, setResetStatus] = useState<Status>(null);

  async function resetAccount() {
    if (resetBusy) return;
    setResetBusy(true);
    setResetStatus(null);
    try {
      const res = await fetch("/api/account/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Xatolik");
      setConfirming(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setResetStatus({
        kind: "err",
        text: err instanceof Error ? err.message : "Xatolik",
      });
      setResetBusy(false);
    }
  }

  async function changeName() {
    if (nameBusy) return;
    const next = displayName.trim();
    if (!next) {
      setNameStatus({ kind: "err", text: "Ism kiriting" });
      return;
    }
    setNameBusy(true);
    setNameStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { name: next } });
    if (error) {
      setNameStatus({ kind: "err", text: error.message });
    } else {
      setNameStatus({ kind: "ok", text: "Ism yangilandi." });
      router.refresh();
    }
    setNameBusy(false);
  }

  async function changeEmail() {
    if (emailBusy) return;
    const next = newEmail.trim();
    if (!next || next === email) {
      setEmailStatus({ kind: "err", text: "Yangi email kiriting" });
      return;
    }
    setEmailBusy(true);
    setEmailStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: next });
    if (error) {
      setEmailStatus({ kind: "err", text: error.message });
    } else {
      setEmailStatus({
        kind: "ok",
        text: "Tasdiqlash havolasi yangi pochtangizga yuborildi.",
      });
      setNewEmail("");
      router.refresh();
    }
    setEmailBusy(false);
  }

  async function changePassword() {
    if (pwBusy) return;
    if (password.length < 6) {
      setPwStatus({
        kind: "err",
        text: "Parol kamida 6 ta belgidan iborat bo'lsin",
      });
      return;
    }
    if (password !== confirm) {
      setPwStatus({ kind: "err", text: "Parollar mos kelmadi" });
      return;
    }
    setPwBusy(true);
    setPwStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPwStatus({ kind: "err", text: error.message });
    } else {
      setPwStatus({ kind: "ok", text: "Parol yangilandi." });
      setPassword("");
      setConfirm("");
    }
    setPwBusy(false);
  }

  function statusLine(status: Status) {
    if (!status) return null;
    return (
      <p
        className={`mt-2 text-[12.5px] font-medium ${
          status.kind === "ok" ? "text-positive" : "text-negative"
        }`}
      >
        {status.text}
      </p>
    );
  }

  return (
    <div>
      {/* Account info */}
      <div className="section">
        <div className="section-head">
          <h2>Hisob ma&apos;lumotlari</h2>
        </div>
        <div className="card card-pad">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-muted">Email</span>
            <span className="text-[13.5px] font-medium text-foreground">
              {email || "—"}
            </span>
          </div>
          {createdAt && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-muted">Ro&apos;yxatdan o&apos;tgan</span>
              <span className="mono text-[13.5px] font-medium text-foreground">
                {formatDate(createdAt)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-muted">Telegram</span>
            <span className="text-[13.5px] font-medium text-foreground">
              {telegramUsername
                ? `@${telegramUsername}${telegramNotify ? " · bildirishnomalar yoqilgan" : ""}`
                : "Ulanmagan"}
            </span>
          </div>
        </div>
      </div>

      {/* Change display name */}
      <div className="section">
        <div className="section-head">
          <h2>Ism</h2>
        </div>
        <div className="card card-pad">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ismingiz (masalan, Shahboz)"
            className="input"
          />
          <p className="mt-2 text-[11.5px] text-muted">
            Asosiy sahifadagi salomlashishda ko&apos;rinadi.
          </p>
          {statusLine(nameStatus)}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={changeName}
              disabled={nameBusy}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {nameBusy ? "..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>

      {/* Change email */}
      <div className="section">
        <div className="section-head">
          <h2>Emailni o&apos;zgartirish</h2>
        </div>
        <div className="card card-pad">
          <p className="mb-2 text-[12.5px] text-muted">
            Joriy email:{" "}
            <span className="font-medium text-foreground">{email || "—"}</span>
          </p>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Yangi email"
            className="input"
          />
          {statusLine(emailStatus)}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={changeEmail}
              disabled={emailBusy}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {emailBusy ? "..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="section">
        <div className="section-head">
          <h2>Parolni o&apos;zgartirish</h2>
        </div>
        <div className="card card-pad">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Yangi parol"
                className="input pr-10"
                autoComplete="new-password"
              />
              <EyeToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />
            </div>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Parolni tasdiqlang"
                className="input pr-10"
                autoComplete="new-password"
              />
              <EyeToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />
            </div>
          </div>
          {statusLine(pwStatus)}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={changePassword}
              disabled={pwBusy}
              className="btn"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {pwBusy ? "..." : "Saqlash"}
            </button>
          </div>
        </div>
      </div>

      {/* Restart / wipe all activity data */}
      <div className="section">
        <div className="section-head">
          <h2>Qaytadan boshlash</h2>
        </div>
        <div
          className="card card-pad"
          style={{ borderColor: "var(--negative)" }}
        >
          <p className="text-[12.5px] text-muted">
            Barcha xarajat, daromad, byudjet, maqsad, qarz, investitsiya va
            suhbatlaringiz butunlay o&apos;chiriladi va hisobingiz noldan
            boshlanadi. Hisobingiz (email, parol) saqlanib qoladi.{" "}
            <span className="font-medium text-negative">
              Bu amalni ortga qaytarib bo&apos;lmaydi.
            </span>
          </p>
          {statusLine(resetStatus)}
          <div className="mt-3">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-medium text-foreground">
                  Ishonchingiz komilmi?
                </span>
                <button
                  type="button"
                  onClick={resetAccount}
                  disabled={resetBusy}
                  className="btn"
                  style={{
                    width: "auto",
                    padding: "10px 16px",
                    background: "var(--negative)",
                    color: "#fff",
                  }}
                >
                  {resetBusy ? "..." : "Ha, hammasini o'chirish"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={resetBusy}
                  className="btn ghost"
                  style={{ width: "auto", padding: "10px 16px" }}
                >
                  Bekor
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResetStatus(null);
                  setConfirming(true);
                }}
                className="btn"
                style={{
                  width: "auto",
                  padding: "10px 16px",
                  background: "transparent",
                  border: "1px solid var(--negative)",
                  color: "var(--negative)",
                }}
              >
                Hammasini tozalash
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="section">
        <form action={signOut}>
          <button
            type="submit"
            className="btn"
            style={{
              width: "100%",
              padding: "12px",
              background: "var(--negative)",
              color: "#fff",
            }}
          >
            Chiqish
          </button>
        </form>
      </div>
    </div>
  );
}
