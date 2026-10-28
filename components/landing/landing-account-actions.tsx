import { Suspense } from "react";
import type { LandingPlacement } from "@/lib/auth/landing-action";
import { readLandingSession } from "@/lib/auth/landing-session.server";
import { LandingAccountClient } from "./landing-account-client";
import { LandingAccountView } from "./landing-account-view";

async function AccountActions({ placement }: { placement: LandingPlacement }) {
  const initialState = await readLandingSession();
  return (
    <LandingAccountClient initialState={initialState} placement={placement} />
  );
}

export function LandingAccountActions({
  placement,
}: {
  placement: LandingPlacement;
}) {
  return (
    <Suspense
      fallback={<LandingAccountView state="signed_out" placement={placement} />}
    >
      <AccountActions placement={placement} />
    </Suspense>
  );
}
