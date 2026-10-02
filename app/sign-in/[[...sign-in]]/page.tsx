import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:px-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase">
        Welcome back
      </h1>
      <p className="mt-2 text-muted">Sign in to continue training.</p>
      <div className="mt-8">
        <SignIn fallbackRedirectUrl="/analyze" />
      </div>
    </main>
  );
}
