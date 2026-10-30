"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignOut } from "@/components/auth/sign-out";
import {
  AccountAccessFailure,
  AccountAccessPending,
} from "@/components/auth/account-access-status";
import { authRoutes } from "@/lib/auth/routes";
import { levelLabels, type PreparationPreferences } from "@/lib/preparation";
import type { PreparationPageKind } from "./preparation-page";
import { PreparationForm } from "./preparation-form";

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg text-primary font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

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
    <section aria-label="Preparation status" className="space-y-6">
      <p className="font-bold" data-testid="account-status">
        You are signed in.
      </p>
      <div className="rounded-xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-heading text-2xl font-bold">
          {levelLabels[level]} preparation
        </h2>
        <p>
          {preferences.targetExamDate ? (
            <>
              Target exam date:{" "}
              <time dateTime={preferences.targetExamDate}>
                {preferences.targetExamDate}
              </time>
            </>
          ) : (
            "No target exam date set."
          )}
        </p>
        <Link
          className={linkClass}
          href={authRoutes.preferences}
          prefetch={false}
        >
          Edit preparation preferences
        </Link>
      </div>
      {kind === "diagnostic" && (
        <p>
          A diagnostic will help identify strengths and learning gaps for your
          chosen level. The assessment is not available yet.
        </p>
      )}
      {kind === "dashboard" && (
        <p>
          Diagnostics and personalized study features are not available yet.
        </p>
      )}
      <LearningLock level={level} />
      <p>
        {level === "professional"
          ? "Professional includes Analytical Ability and excludes Clerical Ability."
          : "Subprofessional includes Clerical Ability and excludes Analytical Ability."}
      </p>
      <Link
        className={linkClass}
        href={
          kind === "dashboard" ? authRoutes.diagnostic : authRoutes.dashboard
        }
        prefetch={false}
      >
        {kind === "dashboard"
          ? "View diagnostic next steps"
          : "Go to your dashboard"}
      </Link>
      <div>
        <SignOut />
      </div>
    </section>
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
      className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed"
    >
      {!access
        ? "Checking learning access…"
        : "Personalized guidance and readiness are locked until you submit a diagnostic for this level."}
    </p>
  );
}
