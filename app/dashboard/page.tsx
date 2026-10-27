import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { SignOut } from "@/components/auth/sign-out";
import { readAccountAccess } from "@/lib/auth/account-access.server";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";

export const metadata: Metadata = {
  title: "Your account | Quilla",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <AuthPageShell title="Your Quilla account">
      <Suspense fallback={<p role="status">Checking account access…</p>}>
        <DashboardContent />
      </Suspense>
    </AuthPageShell>
  );
}

async function DashboardContent() {
  const { clerkUserId, access } = await readAccountAccess("/dashboard");
  return (
    <SessionBoundary userId={clerkUserId}>
      <ApplicationAccessBoundary
        expectedUserId={access.status === "active" ? access.userId : undefined}
      >
        {access.status === "active" ? (
          <section
            className="space-y-6 rounded-xl border border-border bg-card p-6"
            aria-label="Account status"
          >
            <p className="font-bold" data-testid="account-status">
              You are signed in.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Your learning setup is coming next. Exam-level selection,
              diagnostics, and personalized study guidance are not available
              yet.
            </p>
            <SignOut />
          </section>
        ) : null}
      </ApplicationAccessBoundary>
    </SessionBoundary>
  );
}
