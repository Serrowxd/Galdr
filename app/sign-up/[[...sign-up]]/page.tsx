"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safeNext";
import { validateUsernameInput } from "@/lib/username";
import { VegvisirLogo } from "@/components/VegvisirLogo";

const DEBOUNCE_MS = 400;

type Availability = "idle" | "loading" | "available" | "taken" | "error";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageInner />
    </Suspense>
  );
}

function SignUpPageInner() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [availability, setAvailability] = useState<Availability>("idle");
  const availSeq = useRef(0);

  const usernameCheck = validateUsernameInput(username);
  const candidate = usernameCheck.ok ? usernameCheck.value : null;

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

  useEffect(() => {
    if (candidate === null) return;
    const seq = ++availSeq.current;
    const t = window.setTimeout(async () => {
      if (availSeq.current !== seq) return;
      setAvailability("loading");
      try {
        const res = await fetch(`/api/username/available?u=${encodeURIComponent(candidate)}`);
        if (availSeq.current !== seq) return;
        if (!res.ok) {
          setAvailability("error");
          return;
        }
        const data = (await res.json()) as { available?: boolean };
        setAvailability(data.available ? "available" : "taken");
      } catch {
        if (availSeq.current === seq) setAvailability("error");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [candidate]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!usernameCheck.ok) {
      setError(usernameCheck.message);
      return;
    }
    if (availability === "taken") {
      setError("That username is already taken.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { desired_username: usernameCheck.value },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(mapAuthError(signUpError.message));
      return;
    }

    // Supabase can return a user with empty identities when an account already exists.
    // In that case, try to resend confirmation instead of pretending signup just succeeded.
    if ((data.user?.identities?.length ?? 1) === 0) {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (resendError) {
        setError(mapAuthError(resendError.message));
        return;
      }
      setInfo("Account already exists but is unconfirmed. We sent a fresh confirmation email.");
    }

    setSent(true);
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
    setInfo("Confirmation email resent.");
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <VegvisirLogo size={28} className="brand-mark" />
          <h1 className="auth-title">Create your Galdr account</h1>
          <p className="auth-sub">Set up your scribe identity to start publishing staves.</p>
        </div>

        {sent ? (
          <>
            {error && <p className="auth-msg auth-msg-error">{error}</p>}
            {info && <p className="auth-msg auth-msg-info">{info}</p>}
            <p className="auth-sub">
              Check your inbox — we sent a confirmation link to <strong>{email.trim()}</strong>.
              Click it to activate your account and finish setting up your profile.
            </p>
            <button type="button" className="auth-link" onClick={() => void handleResend()}>
              Resend confirmation email
            </button>
            <p className="auth-sub">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="auth-link">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            {error && <p className="auth-msg auth-msg-error">{error}</p>}
            {info && <p className="auth-msg auth-msg-info">{info}</p>}
            <form className="auth-form" onSubmit={handleSignUp}>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="text"
                className="auth-input"
                placeholder="Username"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={username.length > 0 && !usernameCheck.ok ? true : undefined}
                required
              />
              {username.length > 0 && (
                <p
                  className={`auth-hint${availability === "taken" || (!usernameCheck.ok) ? " auth-hint-error" : availability === "available" ? " auth-hint-ok" : ""}`}
                  aria-live="polite"
                >
                  {!usernameCheck.ok
                    ? usernameCheck.message
                    : availability === "loading"
                      ? "Checking availability…"
                      : availability === "available"
                        ? "Username is available."
                        : availability === "taken"
                          ? "Username is already taken."
                          : availability === "error"
                            ? "Couldn't check availability — you can still continue."
                            : ""}
                </p>
              )}
              <input
                type="password"
                className="auth-input"
                placeholder="Password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                className="auth-input"
                placeholder="Confirm password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {username.length === 0 && (
                <p className="auth-hint">Username: letters, numbers, underscores, and hyphens only. Minimum 4 characters.</p>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-block auth-cta"
                disabled={loading || availability === "loading" || availability === "taken"}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
            <p className="auth-sub">
              Already have an account?{" "}
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="auth-link">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
