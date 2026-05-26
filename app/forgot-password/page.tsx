"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";
import { VegvisirLogo } from "@/components/VegvisirLogo";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}

function ForgotPasswordPageInner() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const resetNext = `/reset-password?next=${encodeURIComponent(next)}`;
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(resetNext)}`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <VegvisirLogo size={28} className="brand-mark" />
          <h1 className="auth-title">Reset your password</h1>
        </div>

        {sent ? (
          <>
            <p className="auth-sub">
              If an account exists for that email, we&apos;ve sent a reset link. Check your inbox.
            </p>
            <Link href="/sign-in" className="auth-link">
              Back to sign in
            </Link>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/sign-in" className="auth-link">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </section>
  );
}
