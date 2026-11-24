import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { readAccountAccess } from "@/lib/auth/account-access.server";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SessionBoundary } from "@/components/auth/session-boundary";
import { AdminShell, type AdminSection } from "./admin-shell";

function CheckingAccess() {
  return (
    <AuthPageShell title="Admin workspace" layout="admin">
      <p role="status" className="text-sm text-muted-foreground">
        Checking your admin access…
      </p>
    </AuthPageShell>
  );
}

export function AdminGate({
  returnTo,
  title,
  description,
  current,
  children,
}: {
  returnTo: string;
  title: string;
  description: string;
  current: AdminSection;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<CheckingAccess />}>
      <AdminGateContent
        returnTo={returnTo}
        title={title}
        description={description}
        current={current}
      >
        {children}
      </AdminGateContent>
    </Suspense>
  );
}

async function AdminGateContent({
  returnTo,
  title,
  description,
  current,
  children,
}: {
  returnTo: string;
  title: string;
  description: string;
  current: AdminSection;
  children: ReactNode;
}) {
  const { clerkUserId, access } = await readAccountAccess(returnTo);
  if (access.status === "active") {
    if (access.role !== "admin") return notFound();
    return (
      <AdminShell title={title} description={description} current={current}>
        {children}
      </AdminShell>
    );
  }
  return (
    <AuthPageShell title="Your Quilla account">
      <SessionBoundary userId={clerkUserId}>
        <ApplicationAccessBoundary />
      </SessionBoundary>
    </AuthPageShell>
  );
}
