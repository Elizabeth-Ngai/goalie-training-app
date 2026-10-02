import type { ComponentPropsWithoutRef } from "react";

export default function Panel({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`rounded-card border border-line bg-surface ${className}`} {...props} />;
}
