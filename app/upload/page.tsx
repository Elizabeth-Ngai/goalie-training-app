"use client";

import { useState } from "react";

export default function UploadPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Upload Training Video</h1>

      <p className="text-slate-300 mb-6">
        Upload a short goalie training clip. Start with a ready stance or diving
        drill.
      </p>

      <input
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="mb-6"
      />

      {videoUrl && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold mb-3">Preview</h2>
          <video
            src={videoUrl}
            controls
            className="w-full max-w-2xl rounded-xl border border-slate-700"
          />
        </div>
      )}
    </main>
  );
}