"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
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
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [report, setReport] = useState<GoalieReportData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  // Deterministic adaptation notes returned by the training-plan route,
  // shown only for the just-generated plan (never persisted/reconstructed).
  const [adaptationNotes, setAdaptationNotes] = useState<string[]>([]);
  // Completion state for the just-generated plan — starts empty (nothing
  // trained yet), updated optimistically as the user marks drills.
  const [completions, setCompletions] = useState<Record<string, "completed" | "skipped">>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<"analysis" | "plan" | null>(null);

  // Generated once per uploaded video (in handleUpload, before the Blob
  // upload starts) and reused for every persistence call across the whole
  // lifecycle — analysis-create, plan-update, and eventually the
  // /history/[id] link. A stable client-side id (rather than one returned
  // asynchronously from the create call) is what lets the create endpoint
  // be a safe upsert: a retried "Save" after a timeout re-applies the same
  // id instead of risking a duplicate row.
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Cheap additional guard against firing a redundant concurrent create
  // request (e.g. a fast double-click on "Retry save") — the server-side
  // upsert is the authoritative duplicate-prevention mechanism, this just
  // avoids a pointless extra network call.
  const creatingSessionRef = useRef(false);
  // Guards against a fast double-click firing handlePlayerInfoSubmit twice
  // before React commits the re-render that unmounts PlayerInfoForm.
  const submittingPlanRef = useRef(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  // Profile defaults (stable prefs only) used to prefill the training form.
  // undefined = not yet loaded; null = loaded, no saved profile.
  const [profileDefaults, setProfileDefaults] = useState<Partial<PlayerInfo> | null | undefined>(
    undefined
  );

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load the signed-in user's profile once so the training form (shown later,
  // at stage "analysis-ready") can be prefilled. /analyze is auth-protected by
  // proxy.ts, so the user is signed in and /api/profile returns their row.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (active) setProfileDefaults((data?.defaults as Partial<PlayerInfo>) ?? null);
      } catch {
        if (active) setProfileDefaults(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  // Persistence is purely additive: it never blocks or re-triggers the AI
  // calls above, and a failure here only ever surfaces as saveWarning —
  // report/plan keep rendering from local state regardless.
  async function persistNewSession(
    id: string,
    url: string,
    filename: string,
    reportData: GoalieReportData
  ) {
    if (creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, videoUrl: url, videoFilename: filename, report: reportData }),
      });
      const { ok } = await parseJsonResponse(response);
      if (!ok) throw new Error();
      setSaveWarning(null);
    } catch {
      setSaveWarning("Your analysis is shown below, but it couldn't be saved to your history.");
    } finally {
      creatingSessionRef.current = false;
    }
  }

  async function persistSessionPlan(id: string, info: PlayerInfo, planData: TrainingPlan) {
    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerInfo: info, trainingPlan: planData }),
      });
      const { ok } = await parseJsonResponse(response);
      if (!ok) throw new Error();
      setSaveWarning(null);
    } catch {
      setSaveWarning("Your training plan is shown below, but it couldn't be saved to your history.");
    }
  }

  // Optimistic completion toggle for the just-generated plan. Requires the
  // session to have been persisted (sessionId exists); persists via the
  // completions API, rolling local state back on failure. Never regenerates
  // the plan or makes an AI call.
  async function setCompletionStatus(drillId: string, status: "completed" | "skipped" | null) {
    if (!sessionId) return;
    const previous = completions;
    setCompletions((prev) => {
      const next = { ...prev };
      if (status === null) delete next[drillId];
      else next[drillId] = status;
      return next;
    });
    try {
      const response =
        status === null
          ? await fetch(`/api/sessions/${sessionId}/completions`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drillId }),
            })
          : await fetch(`/api/sessions/${sessionId}/completions`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drillId, status }),
            });
      if (!response.ok) throw new Error();
    } catch {
      setCompletions(previous);
    }
  }

  // Always re-runs the create step then the update step (if plan data
  // exists locally), regardless of which one actually failed — both are
  // idempotent server-side, so retrying the one that already succeeded is
  // a harmless no-op. This makes "Retry save" self-healing without the
  // client needing to track precisely which step failed.
  async function retrySave() {
    if (!sessionId || !videoUrl || !videoFilename || !report) return;
    await persistNewSession(sessionId, videoUrl, videoFilename, report);
    if (playerInfo && plan) {
      await persistSessionPlan(sessionId, playerInfo, plan);
    }
  }

  async function runAnalysis(url: string, id: string, filename: string) {
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

      const reportData = data.report as GoalieReportData;
      setReport(reportData);
      setStage("analysis-ready");
      void persistNewSession(id, url, filename, reportData);
    } catch (err) {
      setErrorMessage((err as Error).message);
      setErrorContext("analysis");
      setStage("error");
    }
  }

  async function handlePlayerInfoSubmit(info: PlayerInfo) {
    // Guards the real double-submit window: a fast double-click fires this
    // handler twice before React has committed the re-render that unmounts
    // PlayerInfoForm (stage flips to "generating-plan" synchronously below,
    // but only takes effect on the next render) — the ref check is
    // synchronous and closes that gap regardless of render timing.
    if (!report || submittingPlanRef.current) return;
    submittingPlanRef.current = true;

    setPlayerInfo(info);
    setStage("generating-plan");
    setErrorMessage(null);
    setErrorContext(null);

    try {
      const response = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // analysisSessionId lets the server exclude THIS session from its own
        // adaptive-history lookup (so the current analysis isn't double-counted
        // as historical). Absent sessionId => server builds no adaptive context
        // and generates from report + playerInfo alone. report is still sent
        // directly — unchanged trust model, see Phase 6 plan §10.
        body: JSON.stringify({ report, playerInfo: info, analysisSessionId: sessionId ?? undefined }),
      });

      const { ok, data } = await parseJsonResponse(response);
      if (!ok) {
        throw new Error(
          (data.error as string) ??
            "Couldn't generate a training plan. Please try again."
        );
      }

      const planData = data.plan as TrainingPlan;
      setPlan(planData);
      setAdaptationNotes(Array.isArray(data.adaptationNotes) ? (data.adaptationNotes as string[]) : []);
      setCompletions({}); // fresh plan, nothing trained yet
      setStage("done");
      if (sessionId) {
        void persistSessionPlan(sessionId, info, planData);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
      setErrorContext("plan");
      setStage("error");
    } finally {
      submittingPlanRef.current = false;
    }
  }

  function handleRetry() {
    if (errorContext === "analysis" && videoUrl && sessionId && videoFilename) {
      runAnalysis(videoUrl, sessionId, videoFilename);
    } else if (errorContext === "plan" && playerInfo) {
      handlePlayerInfoSubmit(playerInfo);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const id = crypto.randomUUID();

    setUploading(true);
    setUploadError(null);
    setSessionId(id);
    setVideoFilename(file.name);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });

      setVideoUrl(blob.url);
      runAnalysis(blob.url, id, file.name);
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
              {saveWarning && (
                <div className="mb-4 rounded-xl border border-border bg-surface p-4">
                  <p className="text-sm text-warn">{saveWarning}</p>
                  <button
                    type="button"
                    onClick={retrySave}
                    className="mt-2 text-sm font-medium text-accent"
                  >
                    Retry save
                  </button>
                </div>
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
          // key remounts the form once the profile resolves so the seeded
          // defaults apply. Only stable fields are prefilled; trainingGoal and
          // availableDays are left for the user to set per session.
          <PlayerInfoForm
            key={profileDefaults === undefined ? "loading" : "ready"}
            initial={profileDefaults ?? undefined}
            onSubmit={handlePlayerInfoSubmit}
            submitting={false}
          />
        )}

        {stage === "generating-plan" && (
          <AnalysisLoading label="Building your 7-day training plan..." />
        )}

        {stage === "done" && plan && (
          <TrainingPlanView
            plan={plan}
            priorities={report?.topPriorities ?? []}
            onSeek={seekTo}
            completions={completions}
            onSetCompletionStatus={setCompletionStatus}
            adaptationNotes={adaptationNotes}
          />
        )}

        {stage === "error" && errorContext === "plan" && errorMessage && (
          <ErrorPanel message={errorMessage} onRetry={handleRetry} />
        )}
      </div>
    </main>
  );
}
