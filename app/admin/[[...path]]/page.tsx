import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { readAccountAccess } from "@/lib/auth/account-access.server";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export default function AdminLandingPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  return (
    <Suspense fallback={<p role="status">Checking access…</p>}>
      <AdminLandingContent params={params} />
    </Suspense>
  );
}

async function AdminLandingContent({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const returnTo = path?.length ? `/admin/${path.join("/")}` : "/admin";
  const { clerkUserId, access } = await readAccountAccess(returnTo);
  if (access.status === "active") {
    // Users are denied even when they guess an admin URL. Every admin data
    // function independently calls requireAdmin(ctx).
    if (access.role !== "admin") return notFound();
    if (!path?.length) redirect("/admin/questions");
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
