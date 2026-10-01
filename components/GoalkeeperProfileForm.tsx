"use client";

import { useState } from "react";
import {
  GoalkeeperProfileDefaults,
  GoalkeeperProfileDefaultsSchema,
  PLAYING_LEVELS,
} from "@/lib/schemas";

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
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Your Goalkeeper Profile</h2>
      <p className="mt-1 text-sm text-muted">
        These defaults prefill your training form each time you analyze a video.
        Your per-session goal and available days are still chosen each time.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Age
          <input
            type="number"
            min={5}
            max={60}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2"
          />
        </label>

        <label className="text-sm">
          Playing level
          <select
            value={playingLevel}
            onChange={(e) =>
              setPlayingLevel(e.target.value as (typeof PLAYING_LEVELS)[number])
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 capitalize"
          >
            {PLAYING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm">
        Usual session duration
        <select
          value={sessionDurationMinutes}
          onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2"
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4">
        <p className="text-sm">Usual equipment</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleEquipment(item)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                equipment.includes(item)
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface-raised hover:border-accent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasTrainingPartner}
          onChange={(e) => setHasTrainingPartner(e.target.checked)}
        />
        I usually have a coach or training partner available
      </label>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
