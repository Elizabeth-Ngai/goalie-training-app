"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmDeleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.push("/history");
    } catch {
      setError("Couldn't delete this session. Please try again.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-bad"
      >
        Delete session
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm">
        This removes the saved analysis from your history. The uploaded video
        will remain in storage.
      </p>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-sm font-medium text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
