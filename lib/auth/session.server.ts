import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getClerkConfiguration } from "./configuration.server";
import { signInDestination } from "./routes";
import { hasActiveSession } from "./session-state";

export async function readSession() {
  getClerkConfiguration();
  try {
    return await auth({ treatPendingAsSignedOut: true });
  } catch {
    // Provider failures fail closed without propagating provider payloads or credentials.
    throw new Error(
      "Account access is temporarily unavailable. Please try again.",
    );
  }
}

export async function requireVerifiedSession(returnTo: string) {
  const session = await readSession();
  if (!hasActiveSession(session) || !session.userId) {
    const requested = (await headers()).get("x-quilla-return-to") ?? returnTo;
    redirect(signInDestination(requested));
  }
  return { ...session, userId: session.userId };
}

export async function requireSession(returnTo: string) {
  const session = await requireVerifiedSession(returnTo);
  return { userId: session.userId };
}
