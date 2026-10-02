"use client";

import { useRef, useState } from "react";
import GoalieReport from "@/components/GoalieReport";
import TrainingPlanView from "@/components/TrainingPlanView";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import type { SessionDetail } from "@/lib/sessions";
import type { CompletionStatus } from "@/lib/schemas";

export default function SessionDetailView({
  session,
  initialCompletions,
}: {
  session: SessionDetail;
  // Fetched server-side (zero AI) and passed in — the drillId → status map
  // for this session's persisted plan.
  initialCompletions: Record<string, CompletionStatus>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completions, setCompletions] =
    useState<Record<string, CompletionStatus>>(initialCompletions);

  // Same seek closure as app/analyze/page.tsx — no AI call, just moves the
  // already-loaded <video> to a timestamp from the saved report/plan.
  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
    video.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.videoFilename}</h1>
          <p className="mt-1 text-sm text-muted">
            {session.createdAt.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <ConfirmDeleteButton sessionId={session.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
            <video ref={videoRef} src={session.videoUrl} controls className="w-full" />
          </div>
        </div>

        <div>
          {session.report.valid ? (
            <GoalieReport report={session.report.data} onSeek={seekTo} />
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-sm text-bad">This saved report could not be loaded.</p>
            </div>
          )}
        </div>
      </div>

      {session.trainingPlan === null ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Training Plan</h2>
          <p className="mt-2 text-sm text-muted">
            No training plan was generated for this session.
          </p>
        </div>
      ) : session.trainingPlan.valid ? (
        <TrainingPlanView
          plan={session.trainingPlan.data}
          priorities={session.report.valid ? session.report.data.topPriorities : []}
          onSeek={seekTo}
          completions={completions}
          onSetCompletionStatus={setCompletionStatus}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Training Plan</h2>
          <p className="mt-2 text-sm text-bad">
            This saved training plan could not be loaded.
          </p>
        </div>
      )}
    </div>
  );
}
