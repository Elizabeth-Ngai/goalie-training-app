"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";
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
    <main className="mx-auto max-w-3xl px-6 py-12">
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

        {videoUrl && (
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
            <video src={videoUrl} controls className="w-full" />
          </div>
        )}

        {videoUrl && stage === "analyzing" && (
          <AnalysisLoading label="Analyzing with AI Goalie..." />
        )}

        {videoUrl && stage === "analysis-ready" && report && (
          <>
            <GoalieReport report={report} />
            <PlayerInfoForm onSubmit={handlePlayerInfoSubmit} submitting={false} />
          </>
        )}

        {videoUrl && stage === "generating-plan" && report && (
          <>
            <GoalieReport report={report} />
            <AnalysisLoading label="Building your 7-day training plan..." />
          </>
        )}

        {videoUrl && stage === "done" && report && plan && (
          <>
            <GoalieReport report={report} />
            <TrainingPlanView plan={plan} />
          </>
        )}

        {videoUrl && stage === "error" && errorMessage && (
          <>
            {errorContext === "plan" && report && <GoalieReport report={report} />}
            <ErrorPanel message={errorMessage} onRetry={handleRetry} />
          </>
        )}
      </div>
    </main>
  );
}
