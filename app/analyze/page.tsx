"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { extractFrames } from "@/lib/extractFrames";
import { GoalieReport as GoalieReportData, PlayerInfo, TrainingPlan } from "@/lib/schemas";
import GoalieReport from "@/components/GoalieReport";
import PlayerInfoForm from "@/components/PlayerInfoForm";
import TrainingPlanView from "@/components/TrainingPlanView";
import AnalysisLoading from "@/components/AnalysisLoading";
import ErrorPanel from "@/components/ErrorPanel";

type Stage =
  | "upload"
  | "analyzing"
  | "analysis-ready"
  | "generating-plan"
  | "done"
  | "error";

// If a serverless function times out or crashes, Vercel returns a plain-text
// error page rather than our JSON — calling response.json() on that throws a
// cryptic "Unexpected token" error. Read the body as text and parse
// defensively so the user always gets a clean, actionable message.
async function parseJsonResponse(
  response: Response
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const text = await response.text();
  try {
    return { ok: response.ok, data: JSON.parse(text) };
  } catch {
    return { ok: false, data: {} };
  }
}

export default function AnalyzePage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [report, setReport] = useState<GoalieReportData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<"analysis" | "plan" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Seek the existing video to a moment from the analysis and play it. Reused
  // for every "Watch 00:04.2" control in the report. scrollIntoView with
  // block:"nearest" is a no-op when the video is already visible (desktop
  // sticky column) and brings it into view when it isn't (mobile stacked).
  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
    video.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function runAnalysis(url: string) {
    setStage("analyzing");
    setErrorMessage(null);
    setErrorContext(null);

    try {
      const frames = await extractFrames(url);
      const response = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });

      const { ok, data } = await parseJsonResponse(response);
      if (!ok) {
        throw new Error(
          (data.error as string) ??
            "Analysis timed out or failed. Please try again."
        );
      }

      setReport(data.report as GoalieReportData);
      setStage("analysis-ready");
    } catch (err) {
      setErrorMessage((err as Error).message);
      setErrorContext("analysis");
      setStage("error");
    }
  }

  async function handlePlayerInfoSubmit(info: PlayerInfo) {
    if (!report) return;

    setPlayerInfo(info);
    setStage("generating-plan");
    setErrorMessage(null);
    setErrorContext(null);

    try {
      const response = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, playerInfo: info }),
      });

      const { ok, data } = await parseJsonResponse(response);
      if (!ok) {
        throw new Error(
          (data.error as string) ??
            "Couldn't generate a training plan. Please try again."
        );
      }

      setPlan(data.plan as TrainingPlan);
      setStage("done");
    } catch (err) {
      setErrorMessage((err as Error).message);
      setErrorContext("plan");
      setStage("error");
    }
  }

  function handleRetry() {
    if (errorContext === "analysis" && videoUrl) {
      runAnalysis(videoUrl);
    } else if (errorContext === "plan" && playerInfo) {
      handlePlayerInfoSubmit(playerInfo);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });

      setVideoUrl(blob.url);
      runAnalysis(blob.url);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">AI Goalie</h1>
      <p className="mt-2 text-muted">
        Upload a goalkeeper training clip to get a personalized coaching
        analysis and training plan.
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

        {uploadError && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-bad">{uploadError}</p>
          </div>
        )}

        {/* Review area: video + analysis report side by side on desktop
            (video sticky so it stays visible while reading), stacked on
            mobile. A single <video> element is kept mounted across stages so
            seeking never reloads it. */}
        {videoUrl && (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
                <video ref={videoRef} src={videoUrl} controls className="w-full" />
              </div>
            </div>

            <div>
              {stage === "analyzing" && (
                <AnalysisLoading label="Analyzing with AI Goalie..." />
              )}
              {report && <GoalieReport report={report} onSeek={seekTo} />}
              {stage === "error" && errorContext === "analysis" && errorMessage && (
                <ErrorPanel message={errorMessage} onRetry={handleRetry} />
              )}
            </div>
          </div>
        )}

        {/* Player form, training plan, and plan-stage states render full-width
            below the review grid — training is intentionally NOT locked into
            the narrow right column (Phase 2 redesigns it as a wider view). */}
        {stage === "analysis-ready" && (
          <PlayerInfoForm onSubmit={handlePlayerInfoSubmit} submitting={false} />
        )}

        {stage === "generating-plan" && (
          <AnalysisLoading label="Building your 7-day training plan..." />
        )}

        {stage === "done" && plan && (
          <TrainingPlanView
            plan={plan}
            priorities={report?.topPriorities ?? []}
            onSeek={seekTo}
          />
        )}

        {stage === "error" && errorContext === "plan" && errorMessage && (
          <ErrorPanel message={errorMessage} onRetry={handleRetry} />
        )}
      </div>
    </main>
  );
}
