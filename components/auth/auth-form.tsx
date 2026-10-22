"use client";

import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
} from "@clerk/nextjs";
import { authRoutes } from "@/lib/auth/routes";

export function AuthForm({
  mode,
  destination,
}: {
  mode: "sign-in" | "sign-up";
  destination: string;
}) {
  const signInUrl = `${authRoutes.signIn}?${new URLSearchParams({ redirect_url: destination })}`;
  const signUpUrl = `${authRoutes.signUp}?${new URLSearchParams({ redirect_url: destination })}`;
  return (
    <div className="flex min-h-48 justify-center" data-testid="auth-form">
      <ClerkLoading>
        <p role="status">Loading secure account form…</p>
      </ClerkLoading>
      <ClerkFailed>
        <p role="alert">
          The account service could not load. Check your connection and reload
          this page to try again.
        </p>
      </ClerkFailed>
      <ClerkLoaded>
        {mode === "sign-in" ? (
          <SignIn
            routing="path"
            path={authRoutes.signIn}
            withSignUp={false}
            signUpUrl={signUpUrl}
            forceRedirectUrl={destination}
            signUpForceRedirectUrl={destination}
          />
        ) : (
          <SignUp
            routing="path"
            path={authRoutes.signUp}
            signInUrl={signInUrl}
            forceRedirectUrl={destination}
            signInForceRedirectUrl={destination}
          />
        )}
      </ClerkLoaded>
    </div>
  );
}
