"use client";

import { useState } from "react";
import {
  GoalkeeperProfileDefaults,
  GoalkeeperProfileDefaultsSchema,
  PLAYING_LEVELS,
} from "@/lib/schemas";
import { Button } from "@/components/ui/Button";

const EQUIPMENT_OPTIONS = ["Cones", "Balls", "Goal", "Wall", "Gloves", "Resistance band"];
const DURATION_OPTIONS = [30, 45, 60, 90];

// Dedicated profile editor for the STABLE default fields only (deliberately
// not the training form — session-specific fields like training goal and this
// week's available days don't belong in a saved profile). Kept separate so the
// training PlayerInfoForm stays focused on generating a plan.
export default function GoalkeeperProfileForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: GoalkeeperProfileDefaults | null;
  onSubmit: (defaults: GoalkeeperProfileDefaults) => void;
  submitting: boolean;
}) {
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : "16");
  const [playingLevel, setPlayingLevel] = useState<(typeof PLAYING_LEVELS)[number]>(
    initial?.playingLevel ?? "competitive"
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(
    initial?.sessionDurationMinutes ?? 45
  );
  const [equipment, setEquipment] = useState<string[]>(initial?.equipment ?? []);
  const [hasTrainingPartner, setHasTrainingPartner] = useState(
    initial?.hasTrainingPartner ?? false
  );
  const [error, setError] = useState<string | null>(null);

  function toggleEquipment(item: string) {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = GoalkeeperProfileDefaultsSchema.safeParse({
      age: Number(age),
      playingLevel,
      sessionDurationMinutes,
      equipment,
      hasTrainingPartner,
    });

    if (!parsed.success) {
      setError("Please enter a valid age.");
      return;
    }

    setError(null);
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-ink uppercase">
        Your Goalkeeper Profile
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        These defaults prefill your training form each time you analyze a video. Your per-session
        goal and available days are still chosen each time.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-ink-soft">
          Age
          <input
            type="number"
            min={5}
            max={60}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="mt-1 w-full rounded-btn border border-line bg-surface-2 px-3 py-2 text-ink"
          />
        </label>

        <label className="text-sm text-ink-soft">
          Playing level
          <select
            value={playingLevel}
            onChange={(e) =>
              setPlayingLevel(e.target.value as (typeof PLAYING_LEVELS)[number])
            }
            className="mt-1 w-full rounded-btn border border-line bg-surface-2 px-3 py-2 text-ink capitalize"
          >
            {PLAYING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm text-ink-soft">
        Usual session duration
        <select
          value={sessionDurationMinutes}
          onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
          className="mt-1 w-full rounded-btn border border-line bg-surface-2 px-3 py-2 text-ink"
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4">
        <p className="text-sm text-ink-soft">Usual equipment</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleEquipment(item)}
              className={`min-h-11 rounded-btn border px-3 py-1.5 text-sm font-semibold transition-colors ${
                equipment.includes(item)
                  ? "border-accent bg-accent text-ground"
                  : "border-line bg-surface-2 text-ink-soft hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={hasTrainingPartner}
          onChange={(e) => setHasTrainingPartner(e.target.checked)}
        />
        I usually have a coach or training partner available
      </label>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} className="mt-5">
        {submitting ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
