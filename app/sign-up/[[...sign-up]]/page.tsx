import { redirect } from "next/navigation";

/** First-time sign-up happens via OAuth in the sign-in modal. */
export default function SignUpPage() {
  redirect("/");
}
