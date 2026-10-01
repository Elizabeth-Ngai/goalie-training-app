import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getAnalysisSession } from "@/lib/sessions";
import SessionDetailView from "@/components/SessionDetailView";

// Always loads the current row — never statically prerendered/cached.
export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // proxy.ts guarantees signed-in; getAnalysisSession scopes to this owner, so
  // another user's id (or a legacy NULL-owner row) resolves to null -> 404,
  // leaking nothing about whether it exists.
  const { userId } = await auth();
  if (!userId) notFound();
  const result = await getAnalysisSession(id, userId);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-bad">We couldn&apos;t load this analysis. Please try again.</p>
        </div>
      </main>
    );
  }

  if (result.data === null) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <SessionDetailView session={result.data} />
    </main>
  );
}
