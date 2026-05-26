import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getDbOptional } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safeNext";
import { tagNewUser } from "@/lib/auth/tagNewUser";
import { claimDesiredUsername } from "@/lib/auth/claimDesiredUsername";

const ALLOWED_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery"]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const errorCode = searchParams.get("error_code");

  // Newer Supabase email links return `code`; exchange it for a session first.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await tagNewUser(supabase, "email");
      await claimDesiredUsername(supabase, getDbOptional());
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type === "signup" || type === "email") {
        await tagNewUser(supabase, "email");
        await claimDesiredUsername(supabase, getDbOptional());
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const nextError = errorCode === "otp_expired" ? "link_expired" : "auth_failed";
  return NextResponse.redirect(`${origin}/sign-in?error=${nextError}`);
}
