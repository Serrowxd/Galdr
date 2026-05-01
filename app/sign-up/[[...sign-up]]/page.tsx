import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <section className="container page-block auth-panel">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </section>
  );
}
