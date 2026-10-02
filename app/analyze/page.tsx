"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { extractFrames } from "@/lib/extractFrames";
import {
  GoalieReport as GoalieReportData,
  MAX_CLIPS_PER_SESSION,
  MAX_CONCURRENT_CLIP_ANALYSES,
  PlayerInfo,
  SessionClipInput,
  TrainingPlan,
} from "@/lib/schemas";
import GoalieReport from "@/components/GoalieReport";
import PlayerInfoForm from "@/components/PlayerInfoForm";
import TrainingPlanView from "@/components/TrainingPlanView";
import AnalysisLoading from "@/components/AnalysisLoading";
import ErrorPanel from "@/components/ErrorPanel";
import ClipPlayer, { buildClipLabels, type ClipPlayerHandle } from "@/components/ClipPlayer";

type Stage = "upload" | "analyzing" | "analysis-ready" | "generating-plan" | "done" | "error";

type ClipStatus = "queued" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "failed";

type ClipState = {
  clipId: string;
  file: File;
  videoFilename: string;
  status: ClipStatus;
  videoUrl?: string; // set once uploaded
  report?: GoalieReportData; // set once analyzed
  error?: string; // why this clip failed (upload vs analysis + message)
};

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

// Run async tasks over `items` with at most `limit` in flight — bounds the
// provider burst (Phase 7: at most MAX_CONCURRENT_CLIP_ANALYSES clips, each
// still running its own 3 providers concurrently, so peak is limit×3).
async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  async function run(): Promise<void> {
    const i = next++;
    if (i >= items.length) return;
    await worker(items[i], i);
    await run();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

const CLIP_STATUS_LABEL: Record<ClipStatus, string> = {
  queued: "Queued",
  uploading: "Uploading…",
  uploaded: "Uploaded",
  analyzing: "Analyzing…",
  analyzed: "Analyzed ✓",
  failed: "Failed",
};

export default function AnalyzePage() {
  const [clips, setClips] = useState<ClipState[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [report, setReport] = useState<GoalieReportData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [adaptationNotes, setAdaptationNotes] = useState<string[]>([]);
  const [completions, setCompletions] = useState<Record<string, "completed" | "skipped">>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<"analysis" | "plan" | null>(null);

  // One client-generated session id for the whole multi-clip session, created
  // when analysis begins. Threaded through create + plan-update + history, and
  // used as the adaptive-history exclusion key (Phase 6).
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The persisted clip payload + partial counts, captured after analysis so
  // "Retry save" can replay persistence without re-running any AI.
  const [persistedClips, setPersistedClips] = useState<SessionClipInput[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const creatingSessionRef = useRef(false);
  const submittingPlanRef = useRef(false);
  const analyzingRef = useRef(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const [profileDefaults, setProfileDefaults] = useState<Partial<PlayerInfo> | null | undefined>(
    undefined
  );

  const playerRef = useRef<ClipPlayerHandle>(null);

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

  // Clip-aware seek, delegated to the shared ClipPlayer. clipId undefined (or
  // unknown — e.g. a legacy clip-less report) falls back to the first clip.
  const seekTo = (seconds: number, clipId?: string) => playerRef.current?.seekTo(seconds, clipId);

  function updateClip(clipId: string, patch: Partial<ClipState>) {
    setClips((prev) => prev.map((c) => (c.clipId === clipId ? { ...c, ...patch } : c)));
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setClips((prev) => {
      const room = MAX_CLIPS_PER_SESSION - prev.length;
      if (room <= 0) {
        setUploadError(`You can analyze up to ${MAX_CLIPS_PER_SESSION} clips at a time.`);
        return prev;
      }
      const toAdd = Array.from(fileList)
        .slice(0, room)
        .map((file) => ({
          clipId: crypto.randomUUID(),
          file,
          videoFilename: file.name,
          status: "queued" as ClipStatus,
        }));
      if (fileList.length > room) {
        setUploadError(`You can analyze up to ${MAX_CLIPS_PER_SESSION} clips at a time.`);
      }
      return [...prev, ...toAdd];
    });
  }

  function removeClip(clipId: string) {
    setClips((prev) => prev.filter((c) => c.clipId !== clipId));
  }

  // Upload one clip then analyze it independently (existing per-clip pipeline,
  // unchanged). Upload failure -> no persisted row. Uploaded-but-analysis-fail
  // -> persisted with status 'failed' (viewable, no evidence). Returns the
  // outcome so the orchestrator can build the session synthesis + persistence
  // from local results (not stale React state).
  async function uploadAndAnalyzeClip(clip: ClipState): Promise<{
    clipId: string;
    videoFilename: string;
    videoUrl?: string;
    status: "analyzed" | "failed";
    report?: GoalieReportData;
  }> {
    // Reuse prior work on retry: a clip already analyzed (e.g. when only the
    // cross-clip synthesis failed) is returned as-is — no re-upload, no
    // re-analysis. A clip that uploaded but failed analysis keeps its Blob
    // URL and only re-runs analysis.
    if (clip.status === "analyzed" && clip.report && clip.videoUrl) {
      return {
        clipId: clip.clipId,
        videoFilename: clip.videoFilename,
        videoUrl: clip.videoUrl,
        status: "analyzed",
        report: clip.report,
      };
    }

    updateClip(clip.clipId, { status: "uploading", error: undefined });
    let videoUrl: string;
    if (clip.videoUrl) {
      videoUrl = clip.videoUrl; // already uploaded on a previous attempt
    } else {
      try {
        const blob = await upload(clip.file.name, clip.file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        videoUrl = blob.url;
      } catch (err) {
        // Upload failed — transient, no row will be persisted for this clip.
        const error = `Upload failed: ${(err as Error).message || "unknown error"}`;
        updateClip(clip.clipId, { status: "failed", error });
        return { clipId: clip.clipId, videoFilename: clip.videoFilename, status: "failed" };
      }
    }

    updateClip(clip.clipId, { status: "analyzing", videoUrl });
    try {
      const frames = await extractFrames(videoUrl);
      const response = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const { ok, data } = await parseJsonResponse(response);
      if (!ok) {
        throw new Error((data.error as string) || `analysis request failed (${response.status})`);
      }
      const clipReport = data.report as GoalieReportData;
      updateClip(clip.clipId, { status: "analyzed", report: clipReport, error: undefined });
      return { clipId: clip.clipId, videoFilename: clip.videoFilename, videoUrl, status: "analyzed", report: clipReport };
    } catch (err) {
      const error = `Analysis failed: ${(err as Error).message || "unknown error"}`;
      updateClip(clip.clipId, { status: "failed", videoUrl, error });
      return { clipId: clip.clipId, videoFilename: clip.videoFilename, videoUrl, status: "failed" };
    }
  }

  async function analyzeAll() {
    if (clips.length === 0 || analyzingRef.current) return;
    analyzingRef.current = true;

    const id = crypto.randomUUID();
    setSessionId(id);
    setStage("analyzing");
    setErrorMessage(null);
    setErrorContext(null);
    setSaveWarning(null);

    try {
      const toAnalyze = clips;
      const results: Awaited<ReturnType<typeof uploadAndAnalyzeClip>>[] = new Array(toAnalyze.length);
      await runPool(toAnalyze, MAX_CONCURRENT_CLIP_ANALYSES, async (clip, index) => {
        results[index] = await uploadAndAnalyzeClip(clip);
      });

      const analyzed = results.filter((r) => r.status === "analyzed" && r.report);
      if (analyzed.length === 0) {
        setErrorMessage("We couldn't analyze any of your clips. Please try again.");
        setErrorContext("analysis");
        setStage("error");
        return;
      }

      // Cross-clip synthesis (route short-circuits + stamps provenance for a
      // single analyzed clip, so this one call covers both cases).
      const synthRes = await fetch("/api/synthesize-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: analyzed.map((r, i) => ({
            clipId: r.clipId,
            clipLabel: `Clip ${results.indexOf(r) + 1} — ${r.videoFilename}`.slice(0, 80) || `Clip ${i + 1}`,
            report: r.report,
          })),
        }),
      });
      const { ok, data } = await parseJsonResponse(synthRes);
      if (!ok) {
        throw new Error((data.error as string) ?? "Couldn't combine your clips. Please try again.");
      }

      const combined = data.report as GoalieReportData;

      // Persist only clips that successfully UPLOADED (have a Blob URL);
      // upload failures leave no row. displayOrder = original add order.
      const clipInputs: SessionClipInput[] = results
        .map((r, index) => ({ r, index }))
        .filter(({ r }) => Boolean(r.videoUrl))
        .map(({ r, index }) => ({
          clipId: r.clipId,
          videoUrl: r.videoUrl as string,
          videoFilename: r.videoFilename,
          displayOrder: index,
          status: r.status,
        }));

      setReport(combined);
      setPersistedClips(clipInputs);
      setAnalyzedCount(analyzed.length);
      setStage("analysis-ready");
      void persistNewSession(id, clipInputs, combined);
    } catch (err) {
      setErrorMessage((err as Error).message);
      setErrorContext("analysis");
      setStage("error");
    } finally {
      analyzingRef.current = false;
    }
  }

  async function persistNewSession(id: string, clipInputs: SessionClipInput[], reportData: GoalieReportData) {
    if (creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, clips: clipInputs, report: reportData }),
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

  async function retrySave() {
    if (!sessionId || persistedClips.length === 0 || !report) return;
    await persistNewSession(sessionId, persistedClips, report);
    if (playerInfo && plan) {
      await persistSessionPlan(sessionId, playerInfo, plan);
    }
  }

  async function handlePlayerInfoSubmit(info: PlayerInfo) {
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
        body: JSON.stringify({ report, playerInfo: info, analysisSessionId: sessionId ?? undefined }),
      });

      const { ok, data } = await parseJsonResponse(response);
      if (!ok) {
        throw new Error((data.error as string) ?? "Couldn't generate a training plan. Please try again.");
      }

      const planData = data.plan as TrainingPlan;
      setPlan(planData);
      setAdaptationNotes(Array.isArray(data.adaptationNotes) ? (data.adaptationNotes as string[]) : []);
      setCompletions({});
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
    if (errorContext === "analysis") {
      analyzeAll();
    } else if (errorContext === "plan" && playerInfo) {
      handlePlayerInfoSubmit(playerInfo);
    }
  }

  // Clips with a Blob URL (uploaded) are playable — including analysis-failed
  // ones (viewable, just no evidence points at them).
  const playerClips = clips
    .filter((c) => c.videoUrl)
    .map((c) => ({ clipId: c.clipId, videoUrl: c.videoUrl as string, videoFilename: c.videoFilename }));
  const clipLabels = buildClipLabels(playerClips);
  const uploadedCount = playerClips.length;
  const isPartial = stage !== "upload" && analyzedCount > 0 && analyzedCount < uploadedCount;
  const showReviewArea = report !== null || stage === "analyzing";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">AI Goalie</h1>
      <p className="mt-2 text-muted">
        Upload up to {MAX_CLIPS_PER_SESSION} goalkeeper clips from the same session for one combined
        coaching analysis and training plan.
      </p>

      <div className="mt-8 space-y-6">
        {/* Clip selection — only in the pre-analysis stage. */}
        {stage === "upload" && (
          <div className="space-y-4">
            {clips.length > 0 && (
              <ul className="space-y-2">
                {clips.map((clip, index) => (
                  <li
                    key={clip.clipId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm">
                      <span className="text-muted">Clip {index + 1} — </span>
                      {clip.videoFilename}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeClip(clip.clipId)}
                      className="shrink-0 text-xs font-medium text-muted hover:text-bad"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {clips.length < MAX_CLIPS_PER_SESSION && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center transition-colors hover:border-accent">
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
                  {clips.length === 0 ? "Click to choose clips" : "Add more clips"}
                </span>
                <span className="text-sm text-muted">
                  MP4, MOV, or WebM · up to {MAX_CLIPS_PER_SESSION}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            )}

            {uploadError && <p className="text-sm text-bad">{uploadError}</p>}

            {clips.length > 0 && (
              <button
                type="button"
                onClick={analyzeAll}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
              >
                Analyze {clips.length} {clips.length === 1 ? "clip" : "clips"}
              </button>
            )}
          </div>
        )}

        {/* Live per-clip status while analyzing. */}
        {stage === "analyzing" && (
          <ul className="space-y-2">
            {clips.map((clip, index) => (
              <li
                key={clip.clipId}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="text-muted">Clip {index + 1} — </span>
                    {clip.videoFilename}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      clip.status === "failed"
                        ? "text-bad"
                        : clip.status === "analyzed"
                          ? "text-good"
                          : "text-muted"
                    }`}
                  >
                    {CLIP_STATUS_LABEL[clip.status]}
                  </span>
                </div>
                {clip.error && <p className="mt-1 text-xs text-bad">{clip.error}</p>}
              </li>
            ))}
          </ul>
        )}

        {/* Review area: clip player + report side by side on desktop. */}
        {showReviewArea && (
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="lg:sticky lg:top-6 lg:self-start">
              {playerClips.length > 0 ? (
                <ClipPlayer ref={playerRef} clips={playerClips} />
              ) : (
                <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
                  Preparing your clips…
                </div>
              )}
            </div>

            <div>
              {stage === "analyzing" && <AnalysisLoading label="Analyzing with AI Goalie..." />}
              {isPartial && report && (
                <p className="mb-4 text-sm text-warn">
                  Analysis based on {analyzedCount} of {uploadedCount} clips.
                </p>
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
              {report && <GoalieReport report={report} onSeek={seekTo} clipLabels={clipLabels} />}
              {stage === "error" && errorContext === "analysis" && errorMessage && (
                <ErrorPanel message={errorMessage} onRetry={handleRetry} />
              )}
            </div>
          </div>
        )}

        {/* Analysis failed before any report (0 clips analyzed). */}
        {stage === "error" && errorContext === "analysis" && errorMessage && !report && (
          <ErrorPanel message={errorMessage} onRetry={handleRetry} />
        )}

        {stage === "analysis-ready" && (
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
            clipLabels={clipLabels}
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
