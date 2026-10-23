import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthForm } from "./auth-form";
import { AuthFormSkeleton } from "./auth-form-skeleton";
import { AuthPageShell } from "./auth-page-shell";
import { safeReturnTo } from "@/lib/auth/routes";
import { readSession } from "@/lib/auth/session.server";
import { hasActiveSession } from "@/lib/auth/session-state";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function AccountPage({
  mode,
  searchParams,
}: {
  mode: "sign-in" | "sign-up";
  searchParams: SearchParams;
}) {
  return (
    <AuthPageShell
      layout="auth"
      title={mode === "sign-in" ? "Welcome back" : "Create your Quilla account"}
    >
      <Suspense fallback={<AuthFormSkeleton mode={mode} />}>
        <AccountContent mode={mode} searchParams={searchParams} />
      </Suspense>
    </AuthPageShell>
  );
}

async function AccountContent({
  mode,
  searchParams,
}: {
  mode: "sign-in" | "sign-up";
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const origin = (await headers()).get("x-quilla-origin") ?? undefined;
  const destination = safeReturnTo(params.redirect_url, origin);
  const session = await readSession();
  if (hasActiveSession(session)) redirect(destination);
  return <AuthForm mode={mode} destination={destination} />;
}
