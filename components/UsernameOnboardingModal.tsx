"use client";

import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readJson } from "@/lib/http";
import {
  ensureValidSuggestionShape,
  normalizeEmailLocalPartToSuggestion,
  validateUsernameInput,
  withRandomCollisionSuffix,
} from "@/lib/clerkUsername";
import type { User } from "@supabase/supabase-js";

const DEBOUNCE_MS = 400;
const COLLISION_ATTEMPTS = 6;

type AvailabilityState = "idle" | "loading" | "available" | "taken" | "error";

/** Outer shell — shows nothing until we know auth state and whether username is set. */
export function UsernameOnboardingModal() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hasUsername, setHasUsername] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    async function check() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u ?? null);
      if (!u) {
        setHasUsername(true);
        return;
      }

      const res = await fetch(
        `/api/username/check?uid=${encodeURIComponent(u.id)}`,
      );
      if (res.ok) {
        const data = await readJson<{ hasUsername?: boolean }>(res);
        setHasUsername(data.hasUsername ?? false);
      } else {
        setHasUsername(false);
      }
    }

    void check();
  }, []);

  if (!user || hasUsername !== false) return null;

  const emailLocal = user.email?.split("@")[0] ?? "";
  const suggestion = ensureValidSuggestionShape(
    normalizeEmailLocalPartToSuggestion(emailLocal),
  );

  return <UsernameOnboardingForm key={user.id} user={user} suggestion={suggestion} />;
}

function UsernameOnboardingForm({
  user,
  suggestion,
}: {
  user: User;
  suggestion: string;
}) {
  const [inputValue, setInputValue] = useState(suggestion);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState<"decline" | "save" | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const availSeq = useRef(0);

  useEffect(() => {
    const validated = validateUsernameInput(inputValue);
    if (!validated.ok) {
      setAvailability("idle");
      return;
    }
    const seq = ++availSeq.current;
    const t = window.setTimeout(async () => {
      if (availSeq.current !== seq) return;
      setAvailability("loading");
      try {
        const res = await fetch(
          `/api/username/availability?u=${encodeURIComponent(validated.value)}`,
          { credentials: "include" },
        );
        if (availSeq.current !== seq) return;
        if (!res.ok) {
          setAvailability("error");
          return;
        }
        const data = await readJson<{ available?: boolean }>(res);
        setAvailability(data.available ? "available" : "taken");
      } catch {
        if (availSeq.current !== seq) return;
        setAvailability("error");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [inputValue]);

  const validation = validateUsernameInput(inputValue);

  async function saveUsername(desired: string) {
    let candidate = desired;
    for (let i = 0; i < COLLISION_ATTEMPTS; i++) {
      const res = await fetch("/api/username/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: candidate }),
      });
      if (res.ok) return;
      const data = await readJson<{ error?: string; collision?: boolean }>(res);
      if (data.collision && i < COLLISION_ATTEMPTS - 1) {
        candidate = withRandomCollisionSuffix(desired);
        continue;
      }
      throw new Error(data.error ?? "Could not save username.");
    }
  }

  const onSave = useCallback(
    async (username: string) => {
      setSubmitError(null);
      setPending(username === suggestion ? "decline" : "save");
      try {
        await saveUsername(username);
        window.location.reload();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not save username.");
      } finally {
        setPending(null);
      }
    },
    [suggestion],
  );

  const busy = pending !== null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-modal-title"
      >
        <h2 id="username-modal-title" className="modal-title">
          Choose a username
        </h2>
        <p className="modal-copy">
          Set how your name appears across Galdr. You can pick your own, or use the
          suggestion from your email.
        </p>

        <label className="label-tiny" htmlFor="username-modal-input">
          Username
        </label>
        <div className="modal-field-row">
          <input
            id="username-modal-input"
            className="input"
            autoComplete="username"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-invalid={validation.ok ? undefined : true}
            aria-describedby="username-modal-status username-modal-hint"
          />
          <span
            id="username-modal-status"
            className="modal-status"
            aria-live="polite"
          >
            {!validation.ok ? (
              <span className="status-msg">{validation.message}</span>
            ) : availability === "loading" ? (
              <Loader2 className="status-loading" size={18} aria-label="Checking" />
            ) : availability === "available" ? (
              <span className="status-available">
                <Check size={18} aria-hidden />
                <span className="sr-only">Available</span>
              </span>
            ) : availability === "taken" ? (
              <span className="status-taken">
                <X size={18} aria-hidden />
                <span className="sr-only">Taken</span>
              </span>
            ) : availability === "error" ? (
              <span className="status-msg">Could not check</span>
            ) : null}
          </span>
        </div>
        <p id="username-modal-hint" className="modal-hint">
          Letters, underscores, and hyphens only. Minimum 4 characters.
        </p>

        {submitError ? (
          <p className="modal-error" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => void onSave(suggestion)}
          >
            {pending === "decline" ? (
              <>
                <Loader2 className="spin" size={13} />
                Applying…
              </>
            ) : (
              "Use email suggestion"
            )}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={
              busy ||
              !validation.ok ||
              availability === "taken" ||
              availability === "loading" ||
              availability === "idle"
            }
            onClick={() => {
              if (validation.ok) void onSave(validation.value);
            }}
          >
            {pending === "save" ? (
              <>
                <Loader2 className="spin" size={13} />
                Saving…
              </>
            ) : (
              "Save username"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
