"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";
import { VegvisirLogo } from "@/components/VegvisirLogo";
import type { Provider } from "@supabase/supabase-js";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "github", label: "Continue with GitHub" },
  { id: "google", label: "Continue with Google" },
  { id: "gitlab", label: "Continue with GitLab" },
];

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link_expired"
      ? "That confirmation link has expired. Request a new one and try again."
      : searchParams.get("error") === "auth_failed"
        ? "That sign-in link was invalid or has expired. Please try again."
        : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  function mapAuthError(message: string): string {
    const lowered = message.toLowerCase();
    if (lowered.includes("email rate limit")) {
      return "Too many email attempts. Please wait a minute and try again.";
    }
    if (lowered.includes("signups not allowed") || lowered.includes("email provider is disabled")) {
      return "Email signup is disabled in Supabase Auth settings.";
    }
    if (lowered.includes("redirect") && lowered.includes("not allowed")) {
      return "Redirect URL is not allowed in Supabase Auth settings.";
    }
    return message;
  }

  const passwordVisible = email.trim().length > 0;

  async function handleOAuth(provider: Provider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setUnconfirmed(false);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      if (signInError.message.toLowerCase().includes("not confirmed")) {
        setUnconfirmed(true);
        setError("Your email isn't confirmed yet. Check your inbox or resend below.");
      } else {
        setError("Invalid email or password.");
      }
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (resendError) {
      setError(mapAuthError(resendError.message));
      return;
    }
    setUnconfirmed(false);
    setInfo("If that account needs confirmation, a new link is on its way.");
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <VegvisirLogo size={28} className="brand-mark" />
          <h1 className="auth-title">Sign in to Galdr</h1>
          <p className="auth-sub">
            Continue with a provider, or use your email. Your scribe identity travels with your account.
          </p>
        </div>

        {error && <p className="auth-msg auth-msg-error">{error}</p>}
        {info && <p className="auth-msg auth-msg-info">{info}</p>}

        <div className="auth-providers">
          {PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="btn btn-soft btn-block"
              onClick={() => void handleOAuth(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="auth-divider"><span>or</span></div>

        <form className="auth-form" onSubmit={handleSignIn}>
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {passwordVisible && (
            <div className="auth-foldout">
              <input
                type="password"
                className="auth-input"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-block" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
              {unconfirmed && (
                <button type="button" className="auth-link" onClick={() => void handleResend()}>
                  Resend confirmation email
                </button>
              )}
              <Link
                href={`/forgot-password?next=${encodeURIComponent(next)}`}
                className="auth-link"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </form>

        <p className="auth-sub">
          New to Galdr?{" "}
          <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="auth-link">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
