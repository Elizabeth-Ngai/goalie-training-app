import PoseAnalyzer from "@/components/PoseAnalyzer";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold text-emerald-600">Step 1 of 1</p>
      <h1 className="mt-2 text-4xl font-bold text-slate-900">
        Upload your training video
      </h1>
      <p className="mt-3 mb-10 text-slate-600">
        Start with a ready stance or diving drill, filmed from the front so
        your full body is visible. Analysis runs locally in your browser —
        nothing is uploaded to a server.
      </p>

      <PoseAnalyzer />
    </main>
  );
}
