import Link from "next/link";

const steps = [
  {
    title: "Upload your footage",
    body: "Record yourself in a ready stance or during a drill and upload the clip.",
  },
  {
    title: "AI tracks your body",
    body: "Pose detection maps your shoulders, hips, knees, and ankles in real time.",
  },
  {
    title: "Get instant feedback",
    body: "See a stance score and specific coaching cues you can act on immediately.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">
      <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-wide text-muted uppercase">
        AI-Powered Coaching
      </span>

      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
        Sharpen your ready stance
      </h1>

      <p className="mt-4 text-lg text-muted">
        Upload goalie training videos and get feedback on stance, footwork,
        diving form, and recovery — powered by real-time pose analysis.
      </p>

      <Link
        href="/upload"
        className="mt-8 inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
      >
        Start Training
      </Link>

      <ol className="mt-16 grid gap-6 text-left sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
            <span className="text-sm font-semibold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-2 font-semibold">{step.title}</h2>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
