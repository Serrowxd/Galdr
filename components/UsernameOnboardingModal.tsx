"use client";

import {
  isClerkAPIResponseError,
  isClerkRuntimeError,
  isReverificationCancelledError,
} from "@clerk/nextjs/errors";
import { useReverification, useUser } from "@clerk/nextjs";
import { Check, Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ensureValidSuggestionShape,
  normalizeEmailLocalPartToSuggestion,
  validateUsernameInput,
  withRandomCollisionSuffix,
} from "@/lib/clerkUsername";

const DEBOUNCE_MS = 400;
const COLLISION_ATTEMPTS = 8;

type AvailabilityCheckMeta =
  | { phase: "idle" }
  | { phase: "loading"; candidate: string }
  | { phase: "done"; candidate: string; available: boolean }
  | { phase: "error"; candidate: string };

type ClerkSignedInUser = NonNullable<ReturnType<typeof useUser>["user"]>;

function isUsernameUnset(username: string | null | undefined): boolean {
  if (username == null) return true;
  return String(username).trim() === "";
}

function shouldRetryUsernameCollision(err: unknown): boolean {
  if (!isClerkAPIResponseError(err)) return false;
  return err.errors.some((e) => {
    const code = (e.code ?? "").toLowerCase();
    const msg = `${e.longMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
    if (code.includes("identifier") || code.includes("username")) return true;
    if (msg.includes("taken") || msg.includes("unavailable") || msg.includes("unique"))
      return true;
    return false;
  });
}

function describeUsernameSaveError(err: unknown): string {
  let base =
    err instanceof Error ? err.message : "Could not set username.";
  if (isClerkAPIResponseError(err) && err.errors[0]?.longMessage?.length) {
    base = err.errors[0].longMessage;
  }
  const lower = base.toLowerCase();
  if (
    lower.includes("username") &&
    lower.includes("not a valid parameter")
  ) {
    return `${base} Turn on Username in Clerk Dashboard → User & authentication → Email, phone, username.`;
  }
  if (lower.includes("additional verification")) {
    return `${base} Complete Clerk’s verification step when prompted (email code, password, etc.). If nothing appears, try refreshing or signing out and back in.`;
  }
  return base;
}

async function updateUsernameWithCollisionRetries(
  update: (username: string) => Promise<unknown>,
  desired: string,
): Promise<void> {
  let candidate = desired;
  for (let i = 0; i < COLLISION_ATTEMPTS; i++) {
    try {
      await update(candidate);
      return;
    } catch (err) {
      if (!shouldRetryUsernameCollision(err) || i === COLLISION_ATTEMPTS - 1) {
        throw err;
      }
      candidate = withRandomCollisionSuffix(desired);
    }
  }
}

export function UsernameOnboardingModal() {
  const { user, isLoaded } = useUser();

  const emailLocal = useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || !email.includes("@")) return "";
    return email.split("@")[0] ?? "";
  }, [user]);

  const suggestion = useMemo(() => {
    const normalized = normalizeEmailLocalPartToSuggestion(emailLocal);
    return ensureValidSuggestionShape(normalized);
  }, [emailLocal]);

  if (!isLoaded || !user) return null;
  if (!isUsernameUnset(user.username)) return null;

  return (
    <UsernameOnboardingModalLoaded
      key={user.id}
      user={user}
      suggestion={suggestion}
    />
  );
}

function UsernameOnboardingModalLoaded({
  user,
  suggestion,
}: {
  user: ClerkSignedInUser;
  suggestion: string;
}) {
  const [inputValue, setInputValue] = useState(suggestion);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"decline" | "save" | null>(
    null,
  );

  const availabilitySeq = useRef(0);

  const [checkMeta, setCheckMeta] = useState<AvailabilityCheckMeta>({
    phase: "idle",
  });

  /** Sensitive profile updates may require step-up verification (Clerk Dashboard → Reverification). */
  const updateUsernameVerified = useReverification((username: string) =>
    user.update({ username }),
  );

  useEffect(() => {
    const validated = validateUsernameInput(inputValue);

    if (!validated.ok) {
      return;
    }

    const seq = ++availabilitySeq.current;

    const t = window.setTimeout(() => {
      if (availabilitySeq.current !== seq) return;
      const candidate = validated.value;
      setCheckMeta({ phase: "loading", candidate });
      void (async () => {
        try {
          const res = await fetch(
            `/api/username/availability?u=${encodeURIComponent(candidate)}`,
            { credentials: "include" },
          );
          if (availabilitySeq.current !== seq) return;
          if (!res.ok) {
            setCheckMeta({ phase: "error", candidate });
            return;
          }
          const data = (await res.json()) as { available?: boolean };
          if (availabilitySeq.current !== seq) return;
          setCheckMeta({
            phase: "done",
            candidate,
            available: Boolean(data.available),
          });
        } catch {
          if (availabilitySeq.current !== seq) return;
          setCheckMeta({ phase: "error", candidate });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(t);
    };
  }, [inputValue]);

  const validation = validateUsernameInput(inputValue);

  const availabilityUi = useMemo((): {
    state: "idle" | "loading" | "available" | "taken" | "error";
  } => {
    const vResult = validateUsernameInput(inputValue);
    if (!vResult.ok) return { state: "idle" };
    const v = vResult.value;
    if (checkMeta.phase === "idle") return { state: "idle" };
    if (checkMeta.phase === "loading" && checkMeta.candidate === v)
      return { state: "loading" };
    if (checkMeta.phase === "done" && checkMeta.candidate === v)
      return { state: checkMeta.available ? "available" : "taken" };
    if (checkMeta.phase === "error" && checkMeta.candidate === v)
      return { state: "error" };
    return { state: "idle" };
  }, [inputValue, checkMeta]);

  const onDecline = useCallback(async () => {
    setSubmitError(null);
    setPendingAction("decline");
    try {
      await updateUsernameWithCollisionRetries(updateUsernameVerified, suggestion);
      await user.reload();
    } catch (err) {
      if (
        isClerkRuntimeError(err) &&
        isReverificationCancelledError(err)
      ) {
        setSubmitError("Verification was cancelled. Try again when you’re ready.");
      } else {
        setSubmitError(describeUsernameSaveError(err));
      }
    } finally {
      setPendingAction(null);
    }
  }, [user, suggestion, updateUsernameVerified]);

  const onSave = useCallback(async () => {
    setSubmitError(null);
    const v = validateUsernameInput(inputValue);
    if (!v.ok) {
      setSubmitError(v.message);
      return;
    }
    setPendingAction("save");
    try {
      await updateUsernameWithCollisionRetries(updateUsernameVerified, v.value);
      await user.reload();
    } catch (err) {
      if (
        isClerkRuntimeError(err) &&
        isReverificationCancelledError(err)
      ) {
        setSubmitError("Verification was cancelled. Try again when you’re ready.");
      } else {
        setSubmitError(describeUsernameSaveError(err));
      }
    } finally {
      setPendingAction(null);
    }
  }, [user, inputValue, updateUsernameVerified]);

  const busy = pendingAction !== null;

  return (
    <div
      className="username-modal-backdrop"
      role="presentation"
      aria-hidden={false}
    >
      <div
        className="username-modal-panel frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-modal-title"
      >
        <h2 id="username-modal-title" className="username-modal-title">
          Choose a username
        </h2>
        <p className="username-modal-copy muted">
          Set how your name appears across Galdr. You can pick your own, or use
          the suggestion from your email.
        </p>

        <label className="username-modal-label" htmlFor="username-modal-input">
          Username
        </label>
        <div className="username-modal-field-row">
          <input
            id="username-modal-input"
            className="input username-modal-input"
            autoComplete="username"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-invalid={validation.ok ? undefined : true}
            aria-describedby="username-modal-status username-modal-hint"
          />
          <span
            id="username-modal-status"
            className="username-modal-status"
            aria-live="polite"
          >
            {!validation.ok ? (
              <span className="username-status-msg">{validation.message}</span>
            ) : availabilityUi.state === "loading" ? (
              <Loader2
                className="username-status-loading"
                size={20}
                aria-label="Checking availability"
              />
            ) : availabilityUi.state === "available" ? (
              <span className="username-status-available">
                <Check size={20} aria-hidden />
                <span className="sr-only">Username available</span>
              </span>
            ) : availabilityUi.state === "taken" ? (
              <span className="username-status-taken">
                <X size={20} aria-hidden />
                <span className="sr-only">Already taken</span>
              </span>
            ) : availabilityUi.state === "error" ? (
              <span className="username-status-msg">Could not check</span>
            ) : null}
          </span>
        </div>
        <p id="username-modal-hint" className="username-modal-hint muted">
          Letters, underscores, and hyphens only. Minimum 4 characters.
        </p>

        {submitError ? (
          <p className="username-modal-error" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="username-modal-actions">
          <button
            type="button"
            className="btn-ghost-sm username-modal-secondary"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            {pendingAction === "decline" ? (
              <>
                <Loader2 className="username-btn-spinner" size={14} />
                Applying…
              </>
            ) : (
              "Use email suggestion"
            )}
          </button>
          <button
            type="button"
            className="btn username-modal-primary"
            disabled={
              busy ||
              !validation.ok ||
              availabilityUi.state === "taken" ||
              availabilityUi.state === "loading" ||
              availabilityUi.state === "idle"
            }
            onClick={() => void onSave()}
          >
            {pendingAction === "save" ? (
              <>
                <Loader2 className="username-btn-spinner" size={14} />
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
