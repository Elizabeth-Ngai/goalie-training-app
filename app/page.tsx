export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">Goalie Training App</h1>
      <p className="text-lg text-slate-300 max-w-xl text-center">
        Upload goalie training videos and get feedback on stance, footwork,
        diving form, and recovery.
      </p>

      <a
        href="/upload"
        className="mt-8 rounded-xl bg-white text-slate-950 px-6 py-3 font-semibold"
      >
        Start Training
      </a>
    </main>
  );
}