"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

export default function AnalyzePage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });

      setVideoUrl(blob.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Analyze Video</h1>
      <p className="mt-2 text-muted">
        Upload a video directly to storage to get a playable URL.
      </p>

      <div className="mt-8 space-y-6">
        <label
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center transition-colors ${
            uploading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-accent"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-muted">
            <path
              d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-medium">
            {uploading ? "Uploading..." : "Click to choose a video"}
          </span>
          <span className="text-sm text-muted">MP4, MOV, or WebM</span>
          <input
            type="file"
            accept="video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-bad">{error}</p>
          </div>
        )}

        {videoUrl && (
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
            <video src={videoUrl} controls className="w-full" />
          </div>
        )}
      </div>
    </main>
  );
}
