"use client";

import { useState } from "react";
import type { ReportPriority } from "@/lib/schemas";
import Eyebrow from "@/components/ui/Eyebrow";
import EvidenceWatch from "@/components/EvidenceWatch";

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-ink-soft">
          <span aria-hidden className="text-muted">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PriorityBody({
  priority,
  onSeek,
  clipLabels,
}: {
  priority: ReportPriority;
  onSeek: (seconds: number, clipId?: string) => void;
  clipLabels?: Record<string, string>;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div>
        <Eyebrow tone="focus">Seen</Eyebrow>
        <BulletList items={priority.observations} />
      </div>
      <div>
        <Eyebrow>Why</Eyebrow>
        <BulletList items={priority.whyItMatters} />
      </div>
      <div>
        <Eyebrow>How to improve</Eyebrow>
        <BulletList items={priority.howToImprove} />
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-bold text-accent">Drill — </span>
        <span className="font-semibold text-ink">{priority.recommendedDrill.name}</span>
        <span className="text-muted"> · {priority.recommendedDrill.purpose}</span>
      </p>
      <EvidenceWatch
        timestamp={priority.timestamp}
        evidenceReferences={priority.evidenceReferences}
        clipLabels={clipLabels}
        onSeek={onSeek}
      />
    </div>
  );
}

export default function PriorityCard({
  priority,
  index,
  onSeek,
  clipLabels,
}: {
  priority: ReportPriority;
  index: number;
  onSeek: (seconds: number, clipId?: string) => void;
  clipLabels?: Record<string, string>;
}) {
  const isPrimary = index === 0;
  const [open, setOpen] = useState(isPrimary);
  const number = String(index + 1).padStart(2, "0");

  const clipSpan = priority.evidenceReferences?.length
    ? new Set(priority.evidenceReferences.map((r) => r.clipId)).size
    : null;
  const totalClips = clipLabels ? Object.keys(clipLabels).length : 1;
  const suffix =
    clipSpan && totalClips > 1
      ? clipSpan === totalClips
        ? ` · ALL ${totalClips} CLIPS`
        : ` · ${clipSpan} ${clipSpan === 1 ? "CLIP" : "CLIPS"}`
      : "";
  const eyebrowText = `${isPrimary ? "TOP PRIORITY" : `PRIORITY ${index + 1}`}${suffix}`;

  if (isPrimary) {
    return (
      <div>
        <div className="flex items-baseline gap-4">
          <span className="font-display text-[56px] leading-none font-extrabold text-focus">
            {number}
          </span>
          <div className="min-w-0">
            <Eyebrow tone="accent">{eyebrowText}</Eyebrow>
            <h3 className="font-display text-3xl leading-tight font-extrabold text-ink uppercase">
              {priority.title}
            </h3>
          </div>
        </div>
        <PriorityBody priority={priority} onSeek={onSeek} clipLabels={clipLabels} />
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-4 text-left"
      >
        <span className="font-display text-2xl leading-none font-extrabold text-muted">
          {number}
        </span>
        <span className="flex-1 font-display text-lg font-bold text-ink uppercase">
          {priority.title}
        </span>
        <span aria-hidden className="text-xl text-muted">
          {open ? "–" : "+"}
        </span>
      </button>
      {open && <PriorityBody priority={priority} onSeek={onSeek} clipLabels={clipLabels} />}
    </div>
  );
}
