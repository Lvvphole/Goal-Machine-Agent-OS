"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/db/supabase-browser";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createBrowserSupabase();
    const next = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (sendError) {
      setStatus("error");
      setError(sendError.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-3xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
        Check your inbox &mdash; magic link sent to <strong>{email}</strong>.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border-0 bg-[#f2f2f7] px-4 py-3 outline-none ring-1 ring-transparent focus:ring-[#e8912e]"
          placeholder="you@example.com"
        />
      </label>
      {error && (
        <div className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}
      <button
        disabled={status === "sending"}
        className="rounded-full bg-[#e8912e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d47f22] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {status === "sending" ? "Sending\u2026" : "Send magic link"}
      </button>
    </form>
  );
}
