"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

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

// A human label for a clip, "Clip N — filename" (never a UUID). Shared with
// EvidenceWatch so report chips and the player selector agree.
export function buildClipLabels(clips: ClipPlayerClip[]): Record<string, string> {
  const labels: Record<string, string> = {};
  clips.forEach((c, i) => {
    labels[c.clipId] = `Clip ${i + 1} — ${c.videoFilename}`;
  });
  return labels;
}

// Shared multi-clip player used by both the analyze page and the history
// detail view. Every clip's <video> stays mounted (only the selected one is
// visible) so a ref is always available and seeking never reloads. For a
// single clip there's no selector chrome — it's just the one player, same as
// before Phase 7.
const ClipPlayer = forwardRef<ClipPlayerHandle, { clips: ClipPlayerClip[] }>(
  function ClipPlayer({ clips }, ref) {
    const [selectedId, setSelectedId] = useState(clips[0]?.clipId ?? "");
    const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        seekTo(seconds: number, clipId?: string) {
          const targetId =
            clipId && clips.some((c) => c.clipId === clipId) ? clipId : clips[0]?.clipId;
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

    return (
      <div>
        {clips.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {clips.map((clip, i) => {
              const selected = clip.clipId === selectedId;
              return (
                <button
                  key={clip.clipId}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => setSelectedId(clip.clipId)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface-raised text-foreground hover:border-accent"
                  }`}
                  title={labels[clip.clipId]}
                >
                  Clip {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {clips.map((clip) => (
          <div
            key={clip.clipId}
            className={clip.clipId === selectedId ? "block" : "hidden"}
          >
            <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black">
              <video
                ref={(el) => {
                  videoRefs.current.set(clip.clipId, el);
                }}
                src={clip.videoUrl}
                controls
                className="w-full"
              />
            </div>
            <p className="mt-1 truncate text-xs text-muted" title={clip.videoFilename}>
              {clips.length > 1 ? labels[clip.clipId] : clip.videoFilename}
            </p>
          </div>
        ))}
      </div>
    );
  }
);

export default ClipPlayer;
