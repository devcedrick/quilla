"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import type {
  LandingPlacement,
  LandingSessionState,
} from "@/lib/auth/landing-action";
import { LandingAccountView } from "./landing-account-view";

const subscribeToHydration = () => () => {};
type Props = { initialState: LandingSessionState; placement: LandingPlacement };

class AccountActionBoundary extends Component<
  { children: ReactNode; placement: LandingPlacement },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <LandingAccountView
        state="unavailable"
        placement={this.props.placement}
      />
    ) : (
      this.props.children
    );
  }
}

function LiveAccountAction({ initialState, placement }: Props) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: true });
  const clerk = useClerk();
  let state = initialState;
  if (hydrated) {
    if (clerk.status === "error") state = "unavailable";
    else if (isLoaded) state = isSignedIn ? "signed_in" : "signed_out";
  }
  // Keep one view mounted across loading and session transitions. Switching
  // between Clerk control-component branches would replace a focused anchor.
  return <LandingAccountView state={state} placement={placement} />;
}

export function LandingAccountClient(props: Props) {
  // Match SSR even if Clerk has loaded or changed identities before hydration.
  return (
    <AccountActionBoundary placement={props.placement}>
      <LiveAccountAction {...props} />
    </AccountActionBoundary>
  );
}
