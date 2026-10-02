"use client";

import { useId, useState } from "react";
import { ReportPriority, TrainingDay, TrainingDrill, TrainingPlan } from "@/lib/schemas";
import {
  computeFocusAreas,
  countTotalDrills,
  countTrainingDays,
  firstSelectableDayIndex,
  sumTrainingMinutes,
} from "@/lib/trainingPlanStats";
import EvidenceWatch from "@/components/EvidenceWatch";
import Eyebrow from "@/components/ui/Eyebrow";

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-btn border border-line bg-surface-2 p-3 text-center">
      <p className="font-display text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function WeeklySummary({ days, priorities }: { days: TrainingDay[]; priorities: ReportPriority[] }) {
  const { primary, secondary } = computeFocusAreas(days, priorities);

  return (
    <div className="mt-4">
      <Eyebrow>Your week</Eyebrow>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <StatTile value={countTrainingDays(days)} label="Training Days" />
        <StatTile value={sumTrainingMinutes(days)} label="Total Minutes" />
        <StatTile value={countTotalDrills(days)} label="Drills" />
      </div>
      {(primary || secondary) && (
        <div className="mt-3 flex flex-wrap gap-4">
          {primary && (
            <div>
              <Eyebrow>Primary focus</Eyebrow>
              <p className="text-sm font-semibold text-accent">{primary.title}</p>
            </div>
          )}
          {secondary && (
            <div>
              <Eyebrow>Secondary focus</Eyebrow>
              <p className="text-sm font-semibold text-ink">{secondary.title}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DaySelector({
  days,
  selectedIndex,
  onSelect,
}: {
  days: TrainingDay[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {days.map((day, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={index}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(index)}
            className={`flex min-h-14 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-btn border px-3 py-2 text-xs font-semibold transition-colors ${
              selected
                ? "border-accent bg-accent text-ground"
                : day.isRestDay
                  ? "border-dashed border-line bg-surface text-muted hover:border-accent"
                  : "border-line bg-surface-2 text-ink hover:border-accent"
            }`}
          >
            <span>{day.day}</span>
            <span className={selected ? "" : "text-muted"}>
              {day.isRestDay ? "Rest" : `${day.durationMinutes}m`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CompletionControl({
  drillId,
  status,
  onSetCompletionStatus,
}: {
  drillId: string;
  status: "completed" | "skipped" | undefined;
  onSetCompletionStatus: (drillId: string, status: "completed" | "skipped" | null) => void;
}) {
  if (status === "completed") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <span className="text-xs font-bold text-accent">✓ Completed</span>
        <button
          type="button"
          onClick={() => onSetCompletionStatus(drillId, null)}
          className="min-h-8 text-xs font-semibold text-muted hover:text-ink"
        >
          Undo
        </button>
      </div>
    );
  }

  if (status === "skipped") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <span className="text-xs font-semibold text-muted">Skipped</span>
        <button
          type="button"
          onClick={() => onSetCompletionStatus(drillId, null)}
          className="min-h-8 text-xs font-semibold text-muted hover:text-ink"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={() => onSetCompletionStatus(drillId, "completed")}
        className="min-h-8 text-xs font-bold text-accent"
      >
        Mark Complete
      </button>
      <button
        type="button"
        onClick={() => onSetCompletionStatus(drillId, "skipped")}
        className="min-h-8 text-xs font-semibold text-muted hover:text-ink"
      >
        Mark Skipped
      </button>
    </div>
  );
}

function DrillCard({
  drill,
  priorities,
  onSeek,
  clipLabels,
  completionStatus,
  onSetCompletionStatus,
}: {
  drill: TrainingDrill;
  priorities: ReportPriority[];
  onSeek: (seconds: number, clipId?: string) => void;
  clipLabels?: Record<string, string>;
  completionStatus?: "completed" | "skipped";
  onSetCompletionStatus?: (drillId: string, status: "completed" | "skipped" | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const instructionsId = useId();
  const linkedPriority = drill.addressesIssueId
    ? (priorities.find((p) => p.id === drill.addressesIssueId) ?? null)
    : null;

  const hasSetsOrReps =
    drill.sets != null || drill.repsOrDuration !== "" || drill.restSeconds != null;

  return (
    <li className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold text-ink">{drill.name}</p>
      <p className="mt-0.5 text-sm text-muted">{drill.purpose}</p>

      {linkedPriority && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">
            <span className="font-bold tracking-wide uppercase">Addresses </span>
            {linkedPriority.title}
          </p>
          <EvidenceWatch
            timestamp={linkedPriority.timestamp}
            evidenceReferences={linkedPriority.evidenceReferences}
            clipLabels={clipLabels}
            onSeek={onSeek}
          />
        </div>
      )}

      {hasSetsOrReps && (
        <p className="mt-2 text-xs text-muted">
          {drill.sets != null && `${drill.sets} sets × `}
          {drill.repsOrDuration}
          {drill.restSeconds != null && ` · ${drill.restSeconds}s rest`}
        </p>
      )}

      {drill.instructions.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={instructionsId}
            onClick={() => setOpen((o) => !o)}
            className="min-h-8 text-xs font-bold text-accent"
          >
            How to Perform {open ? "▲" : "▼"}
          </button>
          {open && (
            <ul id={instructionsId} className="mt-2 space-y-1">
              {drill.instructions.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm text-ink-soft">
                  <span className="text-muted" aria-hidden>
                    •
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* A drill with no drillId (a plan persisted before Phase 6) simply
          offers no completion control — never forced, never fabricated. */}
      {drill.drillId && onSetCompletionStatus && (
        <CompletionControl
          drillId={drill.drillId}
          status={completionStatus}
          onSetCompletionStatus={onSetCompletionStatus}
        />
      )}
    </li>
  );
}

function DayDetail({
  day,
  priorities,
  onSeek,
  clipLabels,
  completions,
  onSetCompletionStatus,
}: {
  day: TrainingDay;
  priorities: ReportPriority[];
  onSeek: (seconds: number, clipId?: string) => void;
  clipLabels?: Record<string, string>;
  completions?: Record<string, "completed" | "skipped">;
  onSetCompletionStatus?: (drillId: string, status: "completed" | "skipped" | null) => void;
}) {
  return (
    <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{day.day}</p>
        {!day.isRestDay && (
          <span className="text-xs text-muted">
            {day.durationMinutes} min · {day.drills.length} drills
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-accent">{day.focus}</p>

      {day.isRestDay ? (
        <p className="mt-3 text-sm text-muted">Rest Day — No scheduled session.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {day.drills.map((drill, index) => (
            <DrillCard
              key={index}
              drill={drill}
              priorities={priorities}
              onSeek={onSeek}
              clipLabels={clipLabels}
              completionStatus={drill.drillId ? completions?.[drill.drillId] : undefined}
              onSetCompletionStatus={onSetCompletionStatus}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrainingPlanView({
  plan,
  priorities,
  onSeek,
  clipLabels,
  completions,
  onSetCompletionStatus,
  adaptationNotes,
}: {
  plan: TrainingPlan;
  priorities: ReportPriority[];
  onSeek: (seconds: number, clipId?: string) => void;
  // clipId -> label for multi-clip drill Watch chips; omitted for legacy.
  clipLabels?: Record<string, string>;
  // Completion tracking (Phase 6) — all optional, so an un-wired caller
  // (or a historical plan whose drills have no drillId) renders a clean,
  // read-only plan exactly as before.
  completions?: Record<string, "completed" | "skipped">;
  onSetCompletionStatus?: (drillId: string, status: "completed" | "skipped" | null) => void;
  // Deterministic, evidence-based adaptation explanation, shown only right
  // after a fresh generation (never reconstructed for historical plans).
  adaptationNotes?: string[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => firstSelectableDayIndex(plan.days));
  const selectedDay = plan.days[selectedIndex] ?? plan.days[0];

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-ink uppercase">
        Your Training Plan
      </h2>
      <p className="mt-2 text-sm text-ink-soft">{plan.overview}</p>

      {adaptationNotes && adaptationNotes.length > 0 && (
        <div className="mt-3 rounded-btn border border-line bg-surface-2 p-3">
          <Eyebrow>How this plan was adapted</Eyebrow>
          <ul className="mt-2 space-y-1">
            {adaptationNotes.map((note, index) => (
              <li key={index} className="flex gap-2 text-sm text-ink-soft">
                <span aria-hidden>•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WeeklySummary days={plan.days} priorities={priorities} />

      <div className="mt-5">
        <Eyebrow>This week</Eyebrow>
      </div>
      <DaySelector days={plan.days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      {selectedDay && (
        <DayDetail
          day={selectedDay}
          priorities={priorities}
          onSeek={onSeek}
          clipLabels={clipLabels}
          completions={completions}
          onSetCompletionStatus={onSetCompletionStatus}
        />
      )}
    </div>
  );
}
