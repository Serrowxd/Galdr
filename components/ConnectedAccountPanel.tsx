"use client";

import {
  isClerkAPIResponseError,
  isClerkRuntimeError,
  isReverificationCancelledError,
} from "@clerk/nextjs/errors";
import { useReverification, useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  GALDR_OAUTH_STRATEGIES,
  oauthStrategyToProvider,
  PENDING_OAUTH_SWAP_KEY,
  providerLabel,
  type GaldrOAuthStrategy,
  type PendingOAuthSwap,
  strategyLabel,
} from "@/lib/clerkAuth";

type ClerkSignedInUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type ExternalAccount = ClerkSignedInUser["externalAccounts"][number];

function readPendingSwap(): PendingOAuthSwap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_OAUTH_SWAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOAuthSwap;
    if (
      typeof parsed.oldAccountId === "string" &&
      typeof parsed.newStrategy === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clearPendingSwap(): void {
  window.localStorage.removeItem(PENDING_OAUTH_SWAP_KEY);
}

type ConnectedAccountPanelProps = {
  onClose?: () => void;
};

export function ConnectedAccountPanel({ onClose }: ConnectedAccountPanelProps) {
  const { user, isLoaded } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const createExternalAccount = useReverification(
    (params: { strategy: GaldrOAuthStrategy; redirectUrl: string }) =>
      user?.createExternalAccount(params),
  );

  const verifiedAccounts = useMemo(() => {
    if (!user) return [];
    return user.externalAccounts.filter(
      (a) => a.verification?.status === "verified",
    );
  }, [user]);

  const primaryAccount = verifiedAccounts[0] ?? user?.externalAccounts[0];

  const swapOptions = useMemo(() => {
    const currentProvider = primaryAccount?.provider;
    return GALDR_OAUTH_STRATEGIES.filter(
      (s) => oauthStrategyToProvider(s) !== currentProvider,
    );
  }, [primaryAccount?.provider]);

  const onChangeProvider = useCallback(
    async (strategy: GaldrOAuthStrategy) => {
      if (!user || !primaryAccount) return;
      setError(null);
      setBusy(true);
      try {
        const pending: PendingOAuthSwap = {
          oldAccountId: primaryAccount.id,
          newStrategy: strategy,
        };
        window.localStorage.setItem(
          PENDING_OAUTH_SWAP_KEY,
          JSON.stringify(pending),
        );

        const redirectUrl = window.location.href;
        const result = await createExternalAccount({
          strategy,
          redirectUrl,
        });

        if (result?.verification?.externalVerificationRedirectURL) {
          window.location.href =
            result.verification.externalVerificationRedirectURL.href;
          return;
        }

        clearPendingSwap();
        await user.reload();
        setShowPicker(false);
        onClose?.();
      } catch (err) {
        clearPendingSwap();
        if (isClerkRuntimeError(err) && isReverificationCancelledError(err)) {
          setError("Verification was cancelled. Try again when you're ready.");
        } else if (isClerkAPIResponseError(err) && err.errors[0]?.longMessage) {
          setError(err.errors[0].longMessage);
        } else {
          setError(
            err instanceof Error ? err.message : "Could not change provider.",
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [user, primaryAccount, createExternalAccount, onClose],
  );

  if (!isLoaded) {
    return (
      <div className="connected-account-panel">
        <Loader2 className="username-status-loading" size={20} aria-hidden />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="connected-account-panel">
      <h3 className="connected-account-title">Connected account</h3>
      <p className="connected-account-copy muted">
        Your Galdr account is linked to one OAuth sign-in. You can replace it
        with a different provider without losing your data.
      </p>

      {primaryAccount ? (
        <div className="connected-account-current frame">
          <span className="connected-account-provider">
            {providerLabel(primaryAccount.provider)}
          </span>
          {primaryAccount.emailAddress ? (
            <span className="connected-account-email muted">
              {primaryAccount.emailAddress}
            </span>
          ) : null}
          <span
            className={`connected-account-status ${
              primaryAccount.verification?.status === "verified"
                ? "is-verified"
                : ""
            }`}
          >
            {primaryAccount.verification?.status === "verified"
              ? "Verified"
              : (primaryAccount.verification?.error?.longMessage ??
                "Pending verification")}
          </span>
        </div>
      ) : (
        <p className="muted">No OAuth provider linked.</p>
      )}

      {error ? (
        <p className="connected-account-error" role="alert">
          {error}
        </p>
      ) : null}

      {!showPicker ? (
        <button
          type="button"
          className="btn-ghost-sm connected-account-change"
          disabled={busy || !primaryAccount}
          onClick={() => setShowPicker(true)}
        >
          Change sign-in provider
        </button>
      ) : (
        <div className="connected-account-picker">
          <p className="connected-account-picker-label muted">
            Choose a new provider
          </p>
          <ul className="connected-account-provider-list">
            {swapOptions.map((strategy) => (
              <li key={strategy}>
                <button
                  type="button"
                  className="btn connected-account-provider-btn"
                  disabled={busy}
                  onClick={() => void onChangeProvider(strategy)}
                >
                  {busy ? (
                    <Loader2 className="username-btn-spinner" size={14} />
                  ) : null}
                  {strategyLabel(strategy)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost-sm"
            disabled={busy}
            onClick={() => setShowPicker(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/** Completes a pending OAuth provider swap after redirect from the new provider. */
export function OAuthSwapHandler() {
  const { user, isLoaded } = useUser();

  const destroyExternalAccount = useReverification(
    (account: ExternalAccount) => account.destroy(),
  );

  useEffect(() => {
    if (!isLoaded || !user) return;

    const pending = readPendingSwap();
    if (!pending) return;

    const verified = user.externalAccounts.filter(
      (a) => a.verification?.status === "verified",
    );

    const newProvider = oauthStrategyToProvider(pending.newStrategy);
    const hasNewVerified = verified.some((a) => a.provider === newProvider);

    if (!hasNewVerified) return;

    void (async () => {
      try {
        const oldAccount = user.externalAccounts.find(
          (a) => a.id === pending.oldAccountId,
        );

        if (oldAccount) {
          await destroyExternalAccount(oldAccount);
        }

        const extras = user.externalAccounts.filter(
          (a) =>
            a.verification?.status === "verified" &&
            a.provider !== newProvider,
        );
        for (const extra of extras) {
          await destroyExternalAccount(extra);
        }

        clearPendingSwap();
        await user.reload();
      } catch {
        clearPendingSwap();
      }
    })();
  }, [isLoaded, user, destroyExternalAccount]);

  return null;
}
