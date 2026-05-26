"use client";

import type { Provider, UserIdentity } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GALDR_OAUTH_PROVIDERS, providerLabel } from "@/lib/auth/oauthProviders";

type ConnectedAccountsSectionProps = {
  /** Whether the user has a password set — affects whether the last identity can be unlinked. */
  hasPassword: boolean;
};

export function ConnectedAccountsSection({ hasPassword }: ConnectedAccountsSectionProps) {
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.getUserIdentities();
    if (err) {
      setError(err.message);
      setIdentities([]);
      return;
    }
    setIdentities(data?.identities ?? []);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.getUserIdentities();
      if (!active) return;
      if (err) {
        setError(err.message);
        setIdentities([]);
        return;
      }
      setIdentities(data?.identities ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const oauthIdentities = (identities ?? []).filter((i) => i.provider !== "email");
  const connectedProviders = new Set(oauthIdentities.map((i) => i.provider));
  const availableToConnect = GALDR_OAUTH_PROVIDERS.filter(
    (p) => !connectedProviders.has(p.id),
  );

  // The last remaining sign-in method may not be removed.
  const signInMethodCount = oauthIdentities.length + (hasPassword ? 1 : 0);

  async function handleConnect(provider: Provider) {
    setError(null);
    setBusy(`connect:${provider}`);
    const supabase = createClient();
    const { error: err } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/settings`,
      },
    });
    if (err) {
      setError(err.message);
      setBusy(null);
    }
    // On success the browser is redirected to the provider; no further work here.
  }

  async function handleDisconnect(identity: UserIdentity) {
    setError(null);
    setBusy(`disconnect:${identity.identity_id}`);
    const supabase = createClient();
    const { error: err } = await supabase.auth.unlinkIdentity(identity);
    if (err) {
      setError(err.message);
      setBusy(null);
      return;
    }
    await reload();
    setBusy(null);
  }

  return (
    <div className="profile-subsection">
      <div className="profile-subsection-head">
        <h3 className="profile-subsection-title">Connected accounts</h3>
        <p className="profile-subsection-desc">
          Link OAuth providers you can sign in with. You can&apos;t remove your last
          sign-in method.
        </p>
      </div>

      {error ? (
        <p className="auth-msg auth-msg-error" role="alert">
          {error}
        </p>
      ) : null}

      {identities === null ? (
        <Loader2 className="spin" size={18} aria-label="Loading" />
      ) : (
        <ul className="identity-list">
          {oauthIdentities.map((identity) => {
            const isLastMethod = signInMethodCount <= 1;
            const disconnecting = busy === `disconnect:${identity.identity_id}`;
            return (
              <li key={identity.identity_id} className="identity-row">
                <span className="identity-provider">
                  {providerLabel(identity.provider)}
                </span>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  disabled={isLastMethod || disconnecting || busy !== null}
                  title={
                    isLastMethod
                      ? "You can't remove your only sign-in method."
                      : undefined
                  }
                  onClick={() => void handleDisconnect(identity)}
                >
                  {disconnecting ? <Loader2 className="spin" size={13} /> : null}
                  Disconnect
                </button>
              </li>
            );
          })}
          {oauthIdentities.length === 0 ? (
            <li className="muted">No OAuth providers connected.</li>
          ) : null}
        </ul>
      )}

      {availableToConnect.length > 0 ? (
        <div className="identity-connect">
          {availableToConnect.map(({ id, label }) => {
            const connecting = busy === `connect:${id}`;
            return (
              <button
                key={id}
                type="button"
                className="btn btn-soft btn-sm"
                disabled={busy !== null}
                onClick={() => void handleConnect(id)}
              >
                {connecting ? <Loader2 className="spin" size={13} /> : null}
                Connect {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
