const FEATURES = [
  {
    icon: "🧍",
    title: "Stance",
    description: "Check your ready position — knee bend, hand height, and balance before the shot.",
  },
  {
    icon: "👟",
    title: "Footwork",
    description: "Track your shuffles and cross-steps to stay square to the ball.",
  },
  {
    icon: "🤾",
    title: "Diving Form",
    description: "Analyze extension, hand positioning, and body shape as you go to ground.",
  },
  {
    icon: "🔄",
    title: "Recovery",
    description: "See how quickly and cleanly you get back to your feet after a save.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden bg-linear-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white">
        <div className="pitch-pattern absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center sm:py-36">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
            ⚽ AI-powered goalkeeper analysis
          </span>

          <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl">
            Train like <span className="text-emerald-400">The Wall</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-emerald-100/80">
            Upload your goalkeeper training clips and get instant feedback on
            stance, footwork, diving form, and recovery — powered by
            real-time, on-device pose detection.
          </p>

          <div className="mt-10 flex justify-center">
            <a
              href="/upload"
              className="rounded-full bg-emerald-500 px-8 py-4 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
            >
              Start Training →
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Everything a keeper needs to level up
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          Drop in a clip and we&apos;ll break your game down into the four
          fundamentals that separate good keepers from great ones.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
