import Link from "next/link";

const steps = [
  {
    title: "Upload your footage",
    body: "Record a training clip or drill and upload it in seconds.",
  },
  {
    title: "Multiple AI models review it",
    body: "Several AI models review your goalkeeper footage, and AI Goalie combines their observations into one coaching report.",
  },
  {
    title: "Get a plan you can act on",
    body: "See clear coaching priorities tied to moments in your video, plus a personalized weekly training plan.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-center">

      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
        Train like a smarter goalkeeper
      </h1>

      <p className="mt-4 text-lg text-muted">
        Upload a goalkeeper clip and get AI coaching feedback on positioning,
        footwork, diving, handling, and recovery — plus a personalized weekly
        training plan.
      </p>

      <Link
        href="/analyze"
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
