import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";
import { readPreparationAccess } from "@/lib/auth/account-access.server";
import { authRoutes } from "@/lib/auth/routes";
import { PreparationContent } from "./preparation-content";

export type PreparationPageKind =
  "dashboard" | "onboarding" | "preferences" | "diagnostic";
const titles = {
  dashboard: "Your Quilla account",
  onboarding: "Choose your exam level",
  preferences: "Preparation preferences",
  diagnostic: "Your diagnostic next steps",
};

export function PreparationPage({ kind }: { kind: PreparationPageKind }) {
  return (
    <AuthPageShell title={titles[kind]}>
      <Suspense fallback={<p role="status">Checking preparation access…</p>}>
        <PreparationResource kind={kind} />
      </Suspense>
    </AuthPageShell>
  );
}

export async function PreparationResource({
  kind,
}: {
  kind: PreparationPageKind;
}) {
  const result = await readPreparationAccess(authRoutes[kind]);
  const { access, clerkUserId } = result;
  const preferences = "preferences" in result ? result.preferences : undefined;
  if (access.status === "active" && preferences) {
    if (!preferences.preferredLevel && kind !== "onboarding")
      redirect(authRoutes.onboarding);
    if (preferences.preferredLevel && kind === "onboarding")
      redirect(authRoutes.dashboard);
  }
  return (
    <SessionBoundary userId={clerkUserId}>
      <ApplicationAccessBoundary
        expectedUserId={access.status === "active" ? access.userId : undefined}
      >
        {access.status === "active" && preferences ? (
          <PreparationContent
            key={access.userId}
            kind={kind}
            initialPreferences={preferences}
          />
        ) : null}
      </ApplicationAccessBoundary>
    </SessionBoundary>
  );
}
