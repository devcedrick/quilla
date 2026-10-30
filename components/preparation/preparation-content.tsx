"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AccountAccessFailure,
  AccountAccessPending,
} from "@/components/auth/account-access-status";
import { authRoutes } from "@/lib/auth/routes";
import type { PreparationPreferences } from "@/lib/preparation";
import type { PreparationPageKind } from "./preparation-page";
import { PreparationForm } from "./preparation-form";
import { PreparationOverview } from "./preparation-overview";

class PreferenceErrorBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AccountAccessFailure retry={this.props.retry} />
    ) : (
      this.props.children
    );
  }
}

export function PreparationContent(props: {
  kind: PreparationPageKind;
  initialPreferences: PreparationPreferences;
}) {
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  // Keep the enclosing application-access subscription alive if a preference
  // read races suspension. It must still replace this subtree with the notice.
  return (
    <PreferenceErrorBoundary
      key={attempt}
      retry={() => {
        setAttempt((value) => value + 1);
        router.refresh();
      }}
    >
      <LivePreparationContent {...props} />
    </PreferenceErrorBoundary>
  );
}

function LivePreparationContent({
  kind,
  initialPreferences,
}: {
  kind: PreparationPageKind;
  initialPreferences: PreparationPreferences;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const live = useQuery(
    api.users.currentPreferences,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const preferences = live ?? initialPreferences;
  const destination =
    live &&
    (!live.preferredLevel && kind !== "onboarding"
      ? authRoutes.onboarding
      : live.preferredLevel && kind === "onboarding" && !saving
        ? authRoutes.dashboard
        : null);
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  if (isLoading || !isAuthenticated || !live || destination)
    return <AccountAccessPending />;
  if (kind === "onboarding" || kind === "preferences")
    return (
      <PreparationForm
        initialPreferences={preferences}
        editing={kind === "preferences"}
        onSavingChange={setSaving}
      />
    );
  if (!preferences.preferredLevel) return <AccountAccessPending />;
  const level = preferences.preferredLevel;
  return (
    <PreparationOverview
      kind={kind}
      preferences={{ ...preferences, preferredLevel: level }}
    >
      <LearningLock level={level} />
    </PreparationOverview>
  );
}

function LearningLock({
  level,
}: {
  level: NonNullable<PreparationPreferences["preferredLevel"]>;
}) {
  const access = useQuery(api.learning.currentAccess, { level });
  return (
    <p
      role="status"
      className="min-w-0 text-sm leading-relaxed text-muted-foreground"
    >
      {!access
        ? "Checking learning access…"
        : "Personalized guidance and readiness are locked until you submit a diagnostic for this level."}
    </p>
  );
}
