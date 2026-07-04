import PoseAnalyzer from "@/components/PoseAnalyzer";

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Upload Training Video</h1>
      <p className="text-slate-300 mb-6">
        Upload a goalie video and the app will detect your body position.
      </p>

      <PoseAnalyzer />
    </main>
  );
}