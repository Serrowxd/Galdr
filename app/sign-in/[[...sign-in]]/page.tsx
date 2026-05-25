import { SignIn } from "@clerk/nextjs";

import { clerkAppearance } from "@/lib/clerkAuth";

/**
 * OAuth callback / fallback route only — not linked from UI.
 * Normal sign-in uses GaldrSignInButton (modal on current page).
 */
export default function SignInPage() {
  return (
    <section className="container page-block auth-panel">
      <SignIn
        routing="path"
        path="/sign-in"
        oauthFlow="popup"
        appearance={clerkAppearance.signIn}
      />
    </section>
  );
}
