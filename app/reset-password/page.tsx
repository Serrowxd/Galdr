"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";
import { VegvisirLogo } from "@/components/VegvisirLogo";

type Status = "checking" | "ready" | "expired" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "ready" : "expired");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus("done");
    setTimeout(() => {
      router.push(next);
      router.refresh();
    }, 1200);
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <VegvisirLogo size={28} className="brand-mark" />
          <h1 className="auth-title">Choose a new password</h1>
        </div>

        {status === "checking" && <p className="auth-sub">Verifying your reset link…</p>}

        {status === "expired" && (
          <>
            <p className="auth-sub">
              This reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Link href="/forgot-password" className="btn btn-soft btn-block">
              Request a new link
            </Link>
          </>
        )}

        {status === "done" && (
          <p className="auth-msg auth-msg-info">Password updated. Redirecting…</p>
        )}

        {status === "ready" && (
          <>
            {error && <p className="auth-msg auth-msg-error">{error}</p>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                type="password"
                className="auth-input"
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                className="auth-input"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-block" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
