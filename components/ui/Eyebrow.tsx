import type { ComponentPropsWithoutRef } from "react";

type Tone = "muted" | "accent" | "focus";

const toneClass: Record<Tone, string> = {
  muted: "text-muted",
  accent: "text-accent",
  focus: "text-focus",
};

export default function Eyebrow({
  tone = "muted",
  className = "",
  ...props
}: { tone?: Tone } & ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={`text-xs font-bold uppercase tracking-[0.12em] ${toneClass[tone]} ${className}`}
      {...props}
    />
  );
}
