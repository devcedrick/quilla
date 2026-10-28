import "server-only";

import { cache } from "react";
import { connection } from "next/server";
import { readSession } from "./session.server";
import { hasActiveSession } from "./session-state";
import type { LandingSessionState } from "./landing-action";

// React cache deduplicates only within a server render request. This is not a
// Next shared cache: no identities, tokens, or decisions persist across requests.
export const readLandingSession = cache(
  async (): Promise<LandingSessionState> => {
    // Keep prerender suspension outside the provider-failure catch below.
    await connection();
    try {
      return hasActiveSession(await readSession()) ? "signed_in" : "signed_out";
    } catch {
      // A public page must remain navigable even when the account service fails.
      return "unavailable";
    }
  },
);
