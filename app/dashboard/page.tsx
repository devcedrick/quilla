import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { SignOut } from "@/components/auth/sign-out";
import { requireSession } from "@/lib/auth/session.server";

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
  const { userId } = await requireSession("/dashboard");
  return (
    <SessionBoundary userId={userId}>
      <section
        className="space-y-6 rounded-xl border border-border bg-card p-6"
        aria-label="Account status"
      >
        <p className="font-bold" data-testid="account-status">
          You are signed in.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Your learning setup is coming next. Exam-level selection, diagnostics,
          and personalized study guidance are not available yet.
        </p>
        <SignOut />
      </section>
    </SessionBoundary>
  );
}
