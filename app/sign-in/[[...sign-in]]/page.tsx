import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <section className="container page-block auth-panel">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </section>
  );
}
