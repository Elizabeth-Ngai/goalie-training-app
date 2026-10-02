"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import GoalieReport from "@/components/GoalieReport";
import TrainingPlanView from "@/components/TrainingPlanView";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import ClipPlayer, {
  buildClipLabels,
  buildReportMarkers,
  type ClipPlayerHandle,
} from "@/components/ClipPlayer";
import Panel from "@/components/ui/Panel";
import Eyebrow from "@/components/ui/Eyebrow";
import type { SessionDetail } from "@/lib/sessions";
import type { CompletionStatus } from "@/lib/schemas";

function formatTitleDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" }).toUpperCase();
}

export default function SessionDetailView({
  session,
  initialCompletions,
}: {
  session: SessionDetail;
  // Fetched server-side (zero AI) and passed in — the drillId → status map
  // for this session's persisted plan.
  initialCompletions: Record<string, CompletionStatus>;
}) {
  const playerRef = useRef<ClipPlayerHandle>(null);
  const [completions, setCompletions] =
    useState<Record<string, CompletionStatus>>(initialCompletions);

  // Clip-aware seek: select the right clip (clipId undefined -> first clip,
  // the legacy single-video fallback) and seek it. No AI call. Delegates to
  // the shared ClipPlayer, which keeps every clip's <video> mounted.
  const seekTo = (seconds: number, clipId?: string) => playerRef.current?.seekTo(seconds, clipId);

  const clipLabels = buildClipLabels(session.clips);
  const isPartial = session.analyzedClipCount < session.uploadedClipCount;
  const markers = session.report.valid
    ? buildReportMarkers(session.report.data, session.clips[0]?.clipId)
    : [];

  // Optimistic local update, then persist. A failed persist rolls the local
  // state back to its previous value. This only ever touches the completions
  // DB — it never regenerates the plan or makes an AI call.
  async function setCompletionStatus(drillId: string, status: CompletionStatus | null) {
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
          ? await fetch(`/api/sessions/${session.id}/completions`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drillId }),
            })
          : await fetch(`/api/sessions/${session.id}/completions`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drillId, status }),
            });
      if (!response.ok) throw new Error();
    } catch {
      setCompletions(previous); // roll back on failure
    }
  }

  const hasValidPlan = session.trainingPlan !== null && session.trainingPlan.valid;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/history" className="text-sm font-semibold text-muted transition-colors hover:text-ink">
          ← History
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight text-ink uppercase sm:text-4xl">
            {formatTitleDate(session.createdAt)} · Training ·{" "}
            {session.clips.length > 1 ? `${session.clips.length} clips` : "1 clip"}
          </h1>
          <div className="flex items-center gap-4">
            {hasValidPlan && (
              <a href="#training-plan" className="text-sm font-semibold text-accent hover:underline">
                View plan →
              </a>
            )}
            <ConfirmDeleteButton sessionId={session.id} />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {isPartial && (
            <>Analysis based on {session.analyzedClipCount} of {session.uploadedClipCount} clips</>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ClipPlayer ref={playerRef} clips={session.clips} markers={markers} />
        </div>

        <div>
          {session.report.valid ? (
            <GoalieReport report={session.report.data} onSeek={seekTo} clipLabels={clipLabels} />
          ) : (
            <Panel className="p-5">
              <p className="text-sm text-danger">This saved report could not be loaded.</p>
            </Panel>
          )}
        </div>
      </div>

      <div id="training-plan">
        {session.trainingPlan === null ? (
          <Panel className="p-5">
            <Eyebrow>Training plan</Eyebrow>
            <p className="mt-2 text-sm text-muted">No training plan was generated for this session.</p>
          </Panel>
        ) : session.trainingPlan.valid ? (
          <TrainingPlanView
            plan={session.trainingPlan.data}
            priorities={session.report.valid ? session.report.data.topPriorities : []}
            onSeek={seekTo}
            clipLabels={clipLabels}
            completions={completions}
            onSetCompletionStatus={setCompletionStatus}
          />
        ) : (
          <Panel className="p-5">
            <Eyebrow>Training plan</Eyebrow>
            <p className="mt-2 text-sm text-danger">This saved training plan could not be loaded.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
