"use client";

import { useState } from "react";
import { PLAYING_LEVELS, PlayerInfo, PlayerInfoSchema, WEEKDAYS } from "@/lib/schemas";

const EQUIPMENT_OPTIONS = ["Cones", "Balls", "Goal", "Wall", "Gloves", "Resistance band"];
const DURATION_OPTIONS = [30, 45, 60, 90];

export default function PlayerInfoForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (info: PlayerInfo) => void;
  submitting: boolean;
}) {
  const [age, setAge] = useState("16");
  const [playingLevel, setPlayingLevel] =
    useState<(typeof PLAYING_LEVELS)[number]>("competitive");
  const [trainingGoal, setTrainingGoal] = useState("");
  const [availableDays, setAvailableDays] = useState<(typeof WEEKDAYS)[number][]>([]);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(45);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [hasTrainingPartner, setHasTrainingPartner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: (typeof WEEKDAYS)[number]) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleEquipment(item: string) {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = PlayerInfoSchema.safeParse({
      age: Number(age),
      playingLevel,
      trainingGoal,
      availableDays,
      sessionDurationMinutes,
      equipment,
      hasTrainingPartner,
    });

    if (!parsed.success) {
      setError("Please fill in age, training goal, and at least one available day.");
      return;
    }

    setError(null);
    onSubmit(parsed.data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">Your Training Information</h2>
      <p className="mt-1 text-sm text-muted">
        Tell us about yourself so AI Goalie can personalize your training plan.
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
        Training goal
        <input
          type="text"
          placeholder="e.g. Improve diving technique before tryouts"
          value={trainingGoal}
          onChange={(e) => setTrainingGoal(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2"
        />
      </label>

      <div className="mt-4">
        <p className="text-sm">Available days</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                availableDays.includes(day)
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface-raised hover:border-accent"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-sm">
        Session duration
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
        <p className="text-sm">Available equipment</p>
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
        I have a coach or training partner available
      </label>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {submitting ? "Generating..." : "Generate My Training Plan"}
      </button>
    </form>
  );
}
