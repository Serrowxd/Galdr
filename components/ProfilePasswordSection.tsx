"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type ProfilePasswordSectionProps = {
  /** Signed-in user's email, used for the reset-link fallback. */
  email: string | null;
  /** Whether the user already has a password (vs. OAuth-only). Controls copy only. */
  hasPassword: boolean;
};

export function ProfilePasswordSection({ email, hasPassword }: ProfilePasswordSectionProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setNotice(hasPassword ? "Password updated." : "Password set.");
  }

  async function handleSendReset() {
    if (!email) return;
    setError(null);
    setNotice(null);
    setSendingReset(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice("Password reset link sent to your email.");
  }

  return (
    <div className="profile-subsection">
      <h3 className="profile-subsection-title">Password</h3>
      <p className="muted">
        {hasPassword
          ? "Change your password, or email yourself a reset link."
          : "Set a password so you can sign in with email as well as OAuth."}
      </p>

      {error ? (
        <p className="auth-msg auth-msg-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="auth-msg auth-msg-info">{notice}</p> : null}

      <form className="profile-password-form" onSubmit={handleSubmit}>
        <input
          type="password"
          className="input"
          placeholder={hasPassword ? "New password" : "Password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Saving…" : hasPassword ? "Update password" : "Set password"}
        </button>
      </form>

      {email ? (
        <button
          type="button"
          className="btn btn-soft btn-sm profile-reset-link"
          disabled={sendingReset}
          onClick={() => void handleSendReset()}
        >
          {sendingReset ? "Sending…" : "Email me a reset link"}
        </button>
      ) : null}
    </div>
  );
}
