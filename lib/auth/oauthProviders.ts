import type { Provider } from "@supabase/supabase-js";

/** OAuth providers enabled for Galdr sign-in and account linking. */
export const GALDR_OAUTH_PROVIDERS: { id: Provider; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "google", label: "Google" },
  { id: "gitlab", label: "GitLab" },
];

export function providerLabel(id: string): string {
  return GALDR_OAUTH_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}
