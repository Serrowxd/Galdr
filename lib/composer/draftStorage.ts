// Draft storage helpers — localStorage-backed, keyed per scope + userId.
// Key format: `tavern:draft:<scopeKey>:<userId|anon>`

export type ComposerScope =
  | { type: "new-thread" }
  | { type: "reply"; commentId: string; threadId: string }
  | { type: "op"; threadId: string }
  | { type: "thread-comment"; threadId: string };

export interface DraftEntry {
  body: string;
  updatedAt: number;
}

export function scopeToKey(scope: ComposerScope): string {
  switch (scope.type) {
    case "new-thread":
      return "new-thread";
    case "reply":
      return `reply:${scope.threadId}:${scope.commentId}`;
    case "op":
      return `op:${scope.threadId}`;
    case "thread-comment":
      return `thread-comment:${scope.threadId}`;
  }
}

function storageKey(scope: ComposerScope, userId: string | null): string {
  return `tavern:draft:${scopeToKey(scope)}:${userId ?? "anon"}`;
}

export function loadDraft(
  scope: ComposerScope,
  userId: string | null,
): DraftEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(scope, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "body" in parsed &&
      "updatedAt" in parsed &&
      typeof (parsed as DraftEntry).body === "string" &&
      typeof (parsed as DraftEntry).updatedAt === "number"
    ) {
      return parsed as DraftEntry;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDraft(
  scope: ComposerScope,
  userId: string | null,
  body: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: DraftEntry = { body, updatedAt: Date.now() };
    localStorage.setItem(storageKey(scope, userId), JSON.stringify(entry));
  } catch {
    // storage may be full — silently ignore
  }
}

export function clearDraft(scope: ComposerScope, userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(scope, userId));
  } catch {
    // ignore
  }
}

export function listDrafts(
  scope: ComposerScope,
  userId: string | null,
): Array<{ key: string; body: string; updatedAt: number }> {
  if (typeof window === "undefined") return [];
  const prefix = `tavern:draft:${scopeToKey(scope)}:${userId ?? "anon"}`;
  const results: Array<{ key: string; body: string; updatedAt: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("tavern:draft:")) continue;
      // For a given scope+user there is only one draft, but we include all
      // same-scope keys so callers can list across sessions if desired.
      if (k === prefix) {
        const entry = loadDraft(scope, userId);
        if (entry) results.push({ key: k, ...entry });
      }
    }
  } catch {
    // ignore
  }
  return results;
}

const STALE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function pruneStaleDrafts(): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const toDelete: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("tavern:draft:")) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as unknown;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "updatedAt" in parsed &&
          typeof (parsed as { updatedAt: number }).updatedAt === "number"
        ) {
          if (now - (parsed as { updatedAt: number }).updatedAt > STALE_MS) {
            toDelete.push(k);
          }
        }
      } catch {
        toDelete.push(k!);
      }
    }
    for (const k of toDelete) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
