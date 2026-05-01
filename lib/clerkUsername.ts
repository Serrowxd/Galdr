/**
 * Clerk username helpers: allowed charset is Unicode letters, underscore, hyphen only (no digits).
 * Min/max length mirrors typical Clerk defaults; reconcile with Dashboard if validation diverges.
 */

export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 64;

/** Matches one allowed character (letters via Unicode property escapes). */
const ALLOWED_CHAR_RE = /^[\p{L}_-]$/u;

function isAllowedChar(ch: string): boolean {
  return ALLOWED_CHAR_RE.test(ch);
}

/**
 * Keep only allowed chars from email local-part; preserve casing; trim leading/trailing underscores/hyphens loosely via inner filter only (trim edges of disallowed).
 */
export function normalizeEmailLocalPartToSuggestion(local: string): string {
  const filtered = [...local].filter(isAllowedChar).join("");
  return filtered.slice(0, USERNAME_MAX_LENGTH);
}

const FALLBACK_PREFIX = "scribe";

function randomLetterSegment(length: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  const g = globalThis.crypto;
  const cryptoObj =
    g !== undefined && typeof g.getRandomValues === "function" ? g : null;
  if (cryptoObj) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out += letters[buf[i]! % letters.length];
    }
    return out;
  }
  for (let i = 0; i < length; i++) {
    out += letters[Math.floor(Math.random() * letters.length)]!;
  }
  return out;
}

/**
 * When email-derived suggestion is empty, build `scribe` + hyphen + random letters (allowed charset only).
 */
export function fallbackUsernameSuggestion(): string {
  const suffix = randomLetterSegment(6);
  const base = `${FALLBACK_PREFIX}-${suffix}`;
  return base.slice(0, USERNAME_MAX_LENGTH);
}

/**
 * Ensure normalized suggestion meets min length using fallback tail if needed.
 */
export function ensureValidSuggestionShape(raw: string): string {
  const s = raw.trim();
  if (s.length >= USERNAME_MIN_LENGTH && s.length <= USERNAME_MAX_LENGTH) {
    return s;
  }
  if (s.length === 0 || s.length < USERNAME_MIN_LENGTH) {
    return fallbackUsernameSuggestion();
  }
  return s.slice(0, USERNAME_MAX_LENGTH);
}

export type ValidateUsernameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateUsernameInput(raw: string): ValidateUsernameResult {
  const trimmed = raw.trim();
  if (!trimmed.length) {
    return { ok: false, message: "Username is required." };
  }
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
    };
  }
  for (const ch of trimmed) {
    if (!isAllowedChar(ch)) {
      return {
        ok: false,
        message: "Use only letters, underscores (_), and hyphens (-).",
      };
    }
  }
  return { ok: true, value: trimmed };
}

/**
 * Append a collision suffix using only allowed characters (hyphen + random letters).
 */
export function withRandomCollisionSuffix(base: string): string {
  const suffix = `-${randomLetterSegment(6)}`;
  const maxBaseLen = USERNAME_MAX_LENGTH - suffix.length;
  const truncated = base.slice(0, Math.max(USERNAME_MIN_LENGTH, maxBaseLen));
  return (truncated + suffix).slice(0, USERNAME_MAX_LENGTH);
}
