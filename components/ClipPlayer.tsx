"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { formatTimestamp, parseTimestamp } from "@/lib/time";
import type { GoalieReport } from "@/lib/schemas";

export type ClipPlayerClip = {
  clipId: string;
  videoUrl: string;
  videoFilename: string;
};

export type ClipPlayerHandle = {
  // Select the clip (if given + known) and seek it. clipId undefined/unknown
  // -> the first clip, which is exactly the legacy single-video behavior.
  seekTo: (seconds: number, clipId?: string) => void;
};

export type ClipMarker = { clipId: string; timestamp: string; tone: "focus" | "accent" };

// A human label for a clip, "Clip N — filename" (never a UUID). Shared with
// EvidenceWatch so report chips and the player selector agree.
export function buildClipLabels(clips: ClipPlayerClip[]): Record<string, string> {
  const labels: Record<string, string> = {};
  clips.forEach((c, i) => {
    labels[c.clipId] = `Clip ${i + 1} — ${c.videoFilename}`;
  });
  return labels;
}

// Derives timeline markers (priorities = focus, strengths = accent) from a
// report's own evidence references — pure reshaping of already-computed
// report data, no new analysis. Legacy findings with no evidenceReferences
// fall back to fallbackClipId (the first clip) so they still show up for
// single-clip sessions.
export function buildReportMarkers(report: GoalieReport, fallbackClipId?: string): ClipMarker[] {
  const markers: ClipMarker[] = [];
  for (const priority of report.topPriorities) {
    if (priority.evidenceReferences?.length) {
      for (const ref of priority.evidenceReferences) {
        markers.push({ clipId: ref.clipId, timestamp: ref.timestamp, tone: "focus" });
      }
    } else if (fallbackClipId) {
      markers.push({ clipId: fallbackClipId, timestamp: priority.timestamp, tone: "focus" });
    }
  }
  for (const strength of report.strengths) {
    if (strength.evidenceReferences?.length) {
      for (const ref of strength.evidenceReferences) {
        markers.push({ clipId: ref.clipId, timestamp: ref.timestamp, tone: "accent" });
      }
    } else if (fallbackClipId) {
      markers.push({ clipId: fallbackClipId, timestamp: strength.timestamp, tone: "accent" });
    }
  }
  return markers;
}

// Shared multi-clip player used by both the analyze page and the history
// detail view. Every clip's <video> stays mounted (only the selected one is
// visible) so a ref is always available and seeking never reloads. For a
// single clip there's no selector chrome — it's just the one player, same as
// before Phase 7.
const ClipPlayer = forwardRef<
  ClipPlayerHandle,
  { clips: ClipPlayerClip[]; markers?: ClipMarker[] }
>(function ClipPlayer({ clips, markers }, ref) {
  const [selectedId, setSelectedId] = useState(clips[0]?.clipId ?? "");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds: number, clipId?: string) {
        const targetId = clipId && clips.some((c) => c.clipId === clipId) ? clipId : clips[0]?.clipId;
        if (!targetId) return;
        setSelectedId(targetId);
        const video = videoRefs.current.get(targetId);
        if (video) {
          video.currentTime = seconds;
          video.play().catch(() => {});
          video.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      },
    }),
    [clips]
  );

  const labels = buildClipLabels(clips);
  const selectedDuration = durations[selectedId];
  const selectedMarkers = (markers ?? [])
    .filter((m) => m.clipId === selectedId)
    .map((m) => ({ ...m, seconds: parseTimestamp(m.timestamp) }))
    .filter((m): m is typeof m & { seconds: number } => m.seconds !== null);

  return (
    <div>
      {clips.map((clip) => (
        <div key={clip.clipId} className={clip.clipId === selectedId ? "block" : "hidden"}>
          <div className="relative w-full overflow-hidden rounded-card border border-line bg-black">
            <video
              ref={(el) => {
                videoRefs.current.set(clip.clipId, el);
              }}
              src={clip.videoUrl}
              controls
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) {
                  setDurations((prev) => (prev[clip.clipId] === d ? prev : { ...prev, [clip.clipId]: d }));
                }
              }}
              className="w-full"
            />
          </div>
          <p className="mt-1 truncate text-xs text-muted" title={clip.videoFilename}>
            {clips.length > 1 ? labels[clip.clipId] : clip.videoFilename}
          </p>
        </div>
      ))}

      {selectedDuration != null && selectedDuration > 0 && (
        <div
          className="relative mt-2 h-12 overflow-hidden rounded-card border border-line bg-surface"
          aria-hidden={selectedMarkers.length === 0}
        >
          {selectedMarkers.map((marker, i) => (
            <span
              key={i}
              className={`absolute top-0 h-full w-[3px] ${
                marker.tone === "accent" ? "bg-accent" : "bg-focus"
              }`}
              style={{ left: `${Math.min(100, (marker.seconds / selectedDuration) * 100)}%` }}
            />
          ))}
        </div>
      )}

      {clips.length > 1 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {clips.map((clip, i) => {
            const selected = clip.clipId === selectedId;
            const duration = durations[clip.clipId];
            return (
              <button
                key={clip.clipId}
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => setSelectedId(clip.clipId)}
                className={`rounded-btn border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-accent bg-surface-2"
                    : "border-line bg-surface-2 hover:border-line-strong"
                }`}
                title={labels[clip.clipId]}
              >
                <span className="block font-display text-sm font-extrabold text-ink uppercase">
                  Clip {i + 1}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {duration != null ? formatTimestamp(duration) : clip.videoFilename}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ClipPlayer;
