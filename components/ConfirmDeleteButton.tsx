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
        className="min-h-11 text-sm font-semibold text-muted hover:text-danger"
      >
        Delete session
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">
        This removes the saved analysis from your history. The uploaded video will remain in
        storage.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="min-h-11 rounded-btn bg-danger px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="min-h-11 text-sm font-semibold text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
