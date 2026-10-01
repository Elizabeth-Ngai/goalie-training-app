"use client";

import { useEffect, useState } from "react";
import GoalkeeperProfileForm from "@/components/GoalkeeperProfileForm";
import type { GoalkeeperProfileDefaults } from "@/lib/schemas";

// Access is enforced by proxy.ts (signed-out users are redirected to sign-in
// before reaching this route); the API also re-checks auth on every call.
export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState<GoalkeeperProfileDefaults | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (active) setDefaults((data?.defaults as GoalkeeperProfileDefaults) ?? null);
      } catch {
        // No saved profile / load failure — fall back to the form's own
        // defaults rather than blocking the page.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave(next: GoalkeeperProfileDefaults) {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaults: next }),
      });
      if (!res.ok) throw new Error();
      setDefaults(next);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
      <p className="mt-2 text-muted">
        Set your default training preferences once and we&apos;ll prefill them
        whenever you analyze a video.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">Loading your profile...</p>
          </div>
        ) : (
          <>
            {/* key forces the form to re-seed from loaded defaults on first load
                and after a successful save. */}
            <GoalkeeperProfileForm
              key={defaults ? "loaded" : "empty"}
              initial={defaults}
              onSubmit={handleSave}
              submitting={status === "saving"}
            />
            {status === "saved" && (
              <p className="mt-3 text-sm text-good">Profile saved.</p>
            )}
            {status === "error" && (
              <p className="mt-3 text-sm text-bad">
                We couldn&apos;t save your profile. Please try again.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
