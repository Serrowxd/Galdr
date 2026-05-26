import { NextResponse } from "next/server";
import { getDbOptional } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safeNext";
import { tagNewUser } from "@/lib/auth/tagNewUser";
import { claimDesiredUsername } from "@/lib/auth/claimDesiredUsername";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      const provider =
        (data.user?.app_metadata?.provider as string | undefined) ?? undefined;
      // Email confirmation links can arrive here (code flow) rather than at
      // /auth/confirm, depending on the email template. Tag by the real provider
      // and claim the username chosen at sign-up so it isn't lost.
      await tagNewUser(supabase, provider === "email" ? "email" : "oauth", provider);
      await claimDesiredUsername(supabase, getDbOptional());
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
}
