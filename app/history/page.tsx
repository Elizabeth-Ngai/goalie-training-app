import { auth } from "@clerk/nextjs/server";
import { listAnalysisSessions } from "@/lib/sessions";
import Panel from "@/components/ui/Panel";
import { ButtonLink } from "@/components/ui/Button";
import SessionRow from "@/components/SessionRow";

// This page reads "newest first" live data on every request — never
// statically prerendered/cached.
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  // proxy.ts already redirects signed-out users to sign-in; this derives the
  // owner id to scope the query. The ownership filter in listAnalysisSessions
  // is the real guarantee a user only ever sees their own sessions.
  const { userId } = await auth();
  const result = userId
    ? await listAnalysisSessions({ userId })
    : ({ ok: false, error: "Unauthorized" } as const);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-14">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink uppercase">
        History
      </h1>
      <p className="mt-2 text-muted">Your previously reviewed goalkeeper sessions.</p>

      <div className="mt-8">
        {!result.ok ? (
          <Panel className="p-5">
            <p className="text-sm text-danger">We couldn&apos;t load your history.</p>
          </Panel>
        ) : result.data.length === 0 ? (
          <Panel className="p-5 text-center">
            <h2 className="font-semibold text-ink">No sessions yet</h2>
            <p className="mt-2 text-sm text-muted">
              Your goalkeeper sessions will appear here after you upload your first video.
            </p>
            <ButtonLink href="/analyze" variant="primary" className="mt-4">
              Upload a clip
            </ButtonLink>
          </Panel>
        ) : (
          <ul className="border-t border-line">
            {result.data.map((item) => (
              <SessionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
