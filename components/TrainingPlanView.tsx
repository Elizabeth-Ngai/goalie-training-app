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
import WatchButton from "@/components/WatchButton";

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function WeeklySummary({
  days,
  priorities,
}: {
  days: TrainingDay[];
  priorities: ReportPriority[];
}) {
  const { primary, secondary } = computeFocusAreas(days, priorities);

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Your Week</h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <StatTile value={countTrainingDays(days)} label="Training Days" />
        <StatTile value={sumTrainingMinutes(days)} label="Total Minutes" />
        <StatTile value={countTotalDrills(days)} label="Drills" />
      </div>
      {(primary || secondary) && (
        <div className="mt-3 flex flex-wrap gap-4">
          {primary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Primary Focus
              </p>
              <p className="text-sm font-medium text-accent">{primary.title}</p>
            </div>
          )}
          {secondary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Secondary Focus
              </p>
              <p className="text-sm font-medium">{secondary.title}</p>
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
            className={`flex min-h-14 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : day.isRestDay
                  ? "border-dashed border-border bg-surface text-muted hover:border-accent"
                  : "border-border bg-surface-raised text-foreground hover:border-accent"
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
        <span className="text-xs font-medium text-good">✓ Completed</span>
        <button
          type="button"
          onClick={() => onSetCompletionStatus(drillId, null)}
          className="min-h-8 text-xs font-medium text-muted hover:text-foreground"
        >
          Undo
        </button>
      </div>
    );
  }

  if (status === "skipped") {
    return (
      <div className="mt-2 flex items-center gap-3">
        <span className="text-xs font-medium text-muted">Skipped</span>
        <button
          type="button"
          onClick={() => onSetCompletionStatus(drillId, null)}
          className="min-h-8 text-xs font-medium text-muted hover:text-foreground"
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
        className="min-h-8 text-xs font-medium text-accent"
      >
        Mark Complete
      </button>
      <button
        type="button"
        onClick={() => onSetCompletionStatus(drillId, "skipped")}
        className="min-h-8 text-xs font-medium text-muted hover:text-foreground"
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
  completionStatus,
  onSetCompletionStatus,
}: {
  drill: TrainingDrill;
  priorities: ReportPriority[];
  onSeek: (seconds: number) => void;
  completionStatus?: "completed" | "skipped";
  onSetCompletionStatus?: (drillId: string, status: "completed" | "skipped" | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const instructionsId = useId();
  const linkedPriority = drill.addressesIssueId
    ? priorities.find((p) => p.id === drill.addressesIssueId) ?? null
    : null;

  const hasSetsOrReps =
    drill.sets != null || drill.repsOrDuration !== "" || drill.restSeconds != null;

  return (
    <li className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold">{drill.name}</p>
      <p className="mt-0.5 text-sm text-muted">{drill.purpose}</p>

      {linkedPriority && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide">Addresses </span>
            {linkedPriority.title}
          </p>
          <WatchButton timestamp={linkedPriority.timestamp} onSeek={onSeek} />
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
            className="min-h-8 text-xs font-medium text-accent"
          >
            How to Perform {open ? "▲" : "▼"}
          </button>
          {open && (
            <ul id={instructionsId} className="mt-2 space-y-1">
              {drill.instructions.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm">
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
  completions,
  onSetCompletionStatus,
}: {
  day: TrainingDay;
  priorities: ReportPriority[];
  onSeek: (seconds: number) => void;
  completions?: Record<string, "completed" | "skipped">;
  onSetCompletionStatus?: (drillId: string, status: "completed" | "skipped" | null) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{day.day}</p>
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
  completions,
  onSetCompletionStatus,
  adaptationNotes,
}: {
  plan: TrainingPlan;
  priorities: ReportPriority[];
  onSeek: (seconds: number) => void;
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
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Your Training Plan</h2>
      <p className="mt-2 text-sm text-muted">{plan.overview}</p>

      {adaptationNotes && adaptationNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-surface-raised p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            How this plan was adapted
          </p>
          <ul className="mt-2 space-y-1">
            {adaptationNotes.map((note, index) => (
              <li key={index} className="flex gap-2 text-sm text-muted">
                <span aria-hidden>•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WeeklySummary days={plan.days} priorities={priorities} />

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
        This Week
      </h3>
      <DaySelector days={plan.days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      {selectedDay && (
        <DayDetail
          day={selectedDay}
          priorities={priorities}
          onSeek={onSeek}
          completions={completions}
          onSetCompletionStatus={onSetCompletionStatus}
        />
      )}
    </div>
  );
}
