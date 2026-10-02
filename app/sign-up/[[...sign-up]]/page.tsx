import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:px-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase">
        Create your account
      </h1>
      <p className="mt-2 text-muted">Start analyzing your goalkeeper performance.</p>
      <div className="mt-8">
        <SignUp fallbackRedirectUrl="/analyze" />
      </div>
    </main>
  );
}
