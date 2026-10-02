// Next.js 16 renamed the middleware file convention to "proxy" (same shape).
// Clerk's clerkMiddleware runs here identically; it makes auth() resolve
// everywhere and, for the matched page routes below, redirects signed-out
// users to Clerk's hosted sign-in.
//
// Only PAGE routes are force-protected here. The /api/* routes are left
// unmatched and instead do their own `await auth()` -> 401 in-handler, so
// they return clean JSON status codes rather than redirects. Ownership
// (which user) is always enforced again at the data layer in lib/sessions.ts
// — this proxy only enforces "is signed in".
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedPage = createRouteMatcher([
  "/analyze(.*)",
  "/history(.*)",
  "/profile(.*)",
  "/progress(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) {
    // Without this, protect() falls back to Clerk's hosted account-portal
    // domain instead of our in-app /sign-in page.
    await auth.protect({ unauthenticatedUrl: new URL("/sign-in", req.url).toString() });
  }
});

export const config = {
  matcher: [
    // Clerk's recommended matcher: skip Next internals and static assets
    // unless referenced in search params, and always run on API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
