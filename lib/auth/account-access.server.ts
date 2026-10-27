import "server-only";

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { requireVerifiedSession } from "./session.server";

export async function readAccountAccess(returnTo: string) {
  // Keep redirects outside the catch: Next navigation exceptions are not failures.
  const session = await requireVerifiedSession(returnTo);
  try {
    const token = await session.getToken({ template: "convex" });
    if (!token) throw new Error("Missing Convex identity token");
    // fetchQuery uses no-store. Never put this request or its token in use cache.
    const access = await fetchQuery(api.users.currentAccess, {}, { token });
    return { clerkUserId: session.userId, access };
  } catch {
    // Do not forward token, provider, deployment, or database error payloads.
    throw new Error(
      "Account access is temporarily unavailable. Please try again.",
    );
  }
}
