import { TrainingPlan } from "@/lib/schemas";

export default function TrainingPlanView({ plan }: { plan: TrainingPlan }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Your Training Plan</h2>
      <p className="mt-2 text-sm text-muted">{plan.overview}</p>

      <div className="mt-4 space-y-4">
        {plan.days.map((day, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-surface-raised p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{day.day}</p>
              {!day.isRestDay && (
                <span className="text-xs text-muted">{day.durationMinutes} min</span>
              )}
            </div>
            <p className="mt-1 text-sm text-accent">{day.focus}</p>

            {day.isRestDay ? (
              <p className="mt-2 text-sm text-muted">Rest Day</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {day.drills.map((drill, drillIndex) => (
                  <li key={drillIndex} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-medium">{drill.name}</p>
                    <p className="text-sm text-muted">{drill.purpose}</p>
                    <p className="mt-1 text-sm">{drill.instructions}</p>
                    <p className="mt-1 text-xs text-muted">
                      {drill.sets != null && `${drill.sets} sets · `}
                      {drill.repsOrDuration}
                      {drill.restSeconds != null && ` · ${drill.restSeconds}s rest`}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Addresses: {drill.addressesIssue}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
