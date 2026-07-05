import PoseAnalyzer from "@/components/PoseAnalyzer";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Upload Training Video</h1>
      <p className="mt-2 text-muted">
        Upload a clip of your ready stance and we&apos;ll score your form and
        point out what to fix.
      </p>

      <div className="mt-8">
        <PoseAnalyzer />
      </div>
    </main>
  );
}
