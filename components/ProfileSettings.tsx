"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { validateUsernameInput } from "@/lib/clerkUsername";
import { BIO_MAX_LENGTH } from "@/lib/auth/claimUsername";
import { compressImageToMax } from "@/lib/image/compressImage";
import { ProfilePasswordSection } from "@/components/ProfilePasswordSection";
import { ConnectedAccountsSection } from "@/components/ConnectedAccountsSection";

const DEBOUNCE_MS = 400;

type AvailabilityState = "idle" | "loading" | "available" | "taken" | "error";

export function ProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [initialBio, setInitialBio] = useState("");

  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const availSeq = useRef(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: userData }, { data: identityData }, profileRes] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getUserIdentities(),
          fetch("/api/profile", { credentials: "include" }),
        ]);
      if (!active) return;

      setEmail(userData.user?.email ?? null);
      setUserId(userData.user?.id ?? null);
      setAvatarUrl(
        (userData.user?.user_metadata?.avatar_url as string | undefined) ?? null,
      );
      setHasPassword(
        (identityData?.identities ?? []).some((i) => i.provider === "email"),
      );

      if (profileRes.ok) {
        const data = (await profileRes.json()) as {
          username?: string | null;
          bio?: string | null;
        };
        const u = data.username ?? "";
        const b = data.bio ?? "";
        setUsername(u);
        setBio(b);
        setInitialUsername(u);
        setInitialBio(b);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const validation = validateUsernameInput(username);
  const usernameChanged = username !== initialUsername;
  const validatedValue = validation.ok ? validation.value : null;

  useEffect(() => {
    // Only check availability for a changed, format-valid username. When the
    // name is unchanged/invalid we skip the fetch; `displayedAvailability`
    // (below) hides any stale result, so no reset setState is needed here.
    if (!usernameChanged || validatedValue === null) {
      return;
    }
    const seq = ++availSeq.current;
    const t = window.setTimeout(async () => {
      if (availSeq.current !== seq) return;
      setAvailability("loading");
      try {
        const res = await fetch(
          `/api/username/availability?u=${encodeURIComponent(validatedValue)}`,
          { credentials: "include" },
        );
        if (availSeq.current !== seq) return;
        if (!res.ok) {
          setAvailability("error");
          return;
        }
        const data = (await res.json()) as { available?: boolean };
        setAvailability(data.available ? "available" : "taken");
      } catch {
        if (availSeq.current !== seq) return;
        setAvailability("error");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [usernameChanged, validatedValue]);

  // Stale availability from a prior check is hidden once the name is unchanged
  // or its format is invalid.
  const displayedAvailability: AvailabilityState =
    usernameChanged && validation.ok ? availability : "idle";

  const dirty = usernameChanged || bio !== initialBio;
  const canSave =
    dirty &&
    !saving &&
    validation.ok &&
    displayedAvailability !== "taken" &&
    displayedAvailability !== "loading";

  async function handleSave() {
    if (!validation.ok) return;
    setError(null);
    setSavedNotice("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: validation.value, bio }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; collision?: boolean };
        if (data.collision) setAvailability("taken");
        throw new Error(data.error ?? "Could not save profile.");
      }
      setInitialUsername(validation.value);
      setInitialBio(bio);
      setUsername(validation.value);
      setAvailability("idle");
      setSavedNotice("Profile saved.");
      setTimeout(() => setSavedNotice(""), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  // Cap the source we'll attempt to decode/compress, to avoid huge memory spikes.
  const AVATAR_SOURCE_LIMIT = 25 * 1024 * 1024;

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !userId) return;

    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > AVATAR_SOURCE_LIMIT) {
      setAvatarError("Image is too large to process. Please pick one under 25 MB.");
      return;
    }

    setAvatarBusy(true);
    try {
      // Compress down to the cap if needed; small files pass through untouched.
      let prepared = file;
      try {
        prepared = await compressImageToMax(file, AVATAR_MAX_BYTES);
      } catch {
        // Decoding/encoding failed — fall back to the original and let the
        // size check below decide.
      }
      if (prepared.size > AVATAR_MAX_BYTES) {
        setAvatarError("Couldn't compress this image under 2 MB. Try a smaller one.");
        return;
      }

      const supabase = createClient();
      const ext = (prepared.name.split(".").pop() ?? "webp").toLowerCase();
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, prepared, {
          upsert: true,
          cacheControl: "3600",
          contentType: prepared.type,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Could not upload picture.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  const avatarInitial = (username || email || "?").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <article className="surface surface-padded profile-panel">
        <Loader2 className="spin" size={20} aria-label="Loading profile" />
      </article>
    );
  }

  return (
    <article className="surface surface-padded profile-panel">
      <div className="profile-subsection">
        <h3 className="profile-subsection-title">Identity</h3>

        <div className="profile-grid">
          <div className="profile-field-group profile-col-full">
            <span className="label-tiny">Profile picture</span>
            <div className="profile-avatar-row">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="profile-avatar" src={avatarUrl} alt="Your profile picture" />
              ) : (
                <span className="profile-avatar-fallback" aria-hidden>
                  {avatarInitial}
                </span>
              )}
              <div className="profile-avatar-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void handleAvatarFile(e)}
                />
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarBusy ? "Uploading…" : avatarUrl ? "Change picture" : "Upload picture"}
                </button>
              </div>
            </div>
            {avatarError ? (
              <p className="auth-msg auth-msg-error" role="alert">
                {avatarError}
              </p>
            ) : null}
          </div>

          <div className="profile-field-group">
            <label className="stack-sm profile-field" htmlFor="profile-username">
              <span className="label-tiny">Username</span>
              <div className="modal-field-row">
                <input
                  id="profile-username"
                  className="input"
                  autoComplete="username"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={validation.ok ? undefined : true}
                  aria-describedby="profile-username-status profile-username-hint"
                />
                <span
                  id="profile-username-status"
                  className="modal-status"
                  aria-live="polite"
                >
                  {usernameChanged && !validation.ok ? (
                    <span className="status-msg">{validation.message}</span>
                  ) : displayedAvailability === "loading" ? (
                    <Loader2 className="status-loading" size={18} aria-label="Checking" />
                  ) : displayedAvailability === "available" ? (
                    <span className="status-available">
                      <Check size={18} aria-hidden />
                      <span className="sr-only">Available</span>
                    </span>
                  ) : displayedAvailability === "taken" ? (
                    <span className="status-taken">
                      <X size={18} aria-hidden />
                      <span className="sr-only">Taken</span>
                    </span>
                  ) : displayedAvailability === "error" ? (
                    <span className="status-msg">Could not check</span>
                  ) : null}
                </span>
              </div>
            </label>
            <p id="profile-username-hint" className="modal-hint">
              Letters, underscores, and hyphens only. Minimum 4 characters.
            </p>
          </div>

          <div className="profile-field-group">
            <label className="stack-sm profile-field" htmlFor="profile-bio">
              <span className="label-tiny">Bio</span>
              <textarea
                id="profile-bio"
                className="input profile-bio-input"
                rows={4}
                maxLength={BIO_MAX_LENGTH}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short line about you."
              />
            </label>
            <p className="modal-hint profile-bio-count">
              {bio.length}/{BIO_MAX_LENGTH}
            </p>
          </div>
        </div>

        {error ? (
          <p className="auth-msg auth-msg-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {savedNotice ? <span className="muted">{savedNotice}</span> : null}
        </div>
      </div>

      <ProfilePasswordSection email={email} hasPassword={hasPassword} />
      <ConnectedAccountsSection hasPassword={hasPassword} />
    </article>
  );
}
