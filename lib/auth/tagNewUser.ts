import type { SupabaseClient } from "@supabase/supabase-js";

type Source = "email" | "oauth";

/**
 * Stamp signup-provenance identifiers onto the authenticated user's
 * `user_metadata`. Runs server-side on an established session, so it cannot be
 * spoofed by the client's `signUp` `options.data`. Idempotent: only writes when
 * `created_via` is absent, so recovery/repeat confirmations don't overwrite it.
 *
 * NOTE: these tags are untrusted display/provenance data — never read them for
 * authorization decisions.
 */
export async function tagNewUser(
  supabase: SupabaseClient,
  source: Source,
  provider?: string,
): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return;
  if (data.user.user_metadata?.created_via) return;

  await supabase.auth.updateUser({
    data: {
      created_via: source,
      provider: provider ?? source,
      signup_at: new Date().toISOString(),
    },
  });
}
