import { notFound } from "next/navigation";
import { Suspense } from "react";
import { readAccountAccess } from "@/lib/auth/account-access.server";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function ReservedAdminPage() {
  return (
    <Suspense fallback={<p role="status">Checking access…</p>}>
      <ReservedAdminContent />
    </Suspense>
  );
}

async function ReservedAdminContent() {
  const { clerkUserId, access } = await readAccountAccess("/admin");
  if (access.status === "active") {
    // Users are denied; admins remain unavailable until administrative UI ships.
    // Future admin data functions must independently call requireAdmin(ctx).
    if (access.role !== "admin") return notFound();
    return notFound();
  }
  return (
    <AuthPageShell title="Your Quilla account">
      <SessionBoundary userId={clerkUserId}>
        <ApplicationAccessBoundary />
      </SessionBoundary>
    </AuthPageShell>
  );
}
