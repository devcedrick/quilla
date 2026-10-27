"use client";

import { useSyncExternalStore } from "react";
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
} from "@clerk/nextjs";
import { authRoutes } from "@/lib/auth/routes";
import { clerkAppearance } from "./clerk-appearance";
import { AuthFormSkeleton } from "./auth-form-skeleton";

const subscribeToHydration = () => () => {};

export function AuthForm({
  mode,
  destination,
}: {
  mode: "sign-in" | "sign-up";
  destination: string;
}) {
  // Clerk can finish loading before this streamed subtree hydrates. Keep its
  // server and first hydration render identical, then read Clerk's live state.
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const signInUrl = `${authRoutes.signIn}?${new URLSearchParams({ redirect_url: destination })}`;
  const signUpUrl = `${authRoutes.signUp}?${new URLSearchParams({ redirect_url: destination })}`;
  return (
    <div
      className="flex min-h-48 w-full min-w-0 justify-center"
      data-testid="auth-form"
    >
      {!hasHydrated ? (
        <AuthFormSkeleton mode={mode} />
      ) : (
        <>
          <ClerkLoading>
            <AuthFormSkeleton mode={mode} />
          </ClerkLoading>
          <ClerkFailed>
            <p
              role="alert"
              className="w-full rounded-xl border border-destructive bg-background p-5 leading-relaxed"
            >
              The account service could not load. Check your connection and
              reload this page to try again.
            </p>
          </ClerkFailed>
          <ClerkLoaded>
            {mode === "sign-in" ? (
              <SignIn
                fallback={<AuthFormSkeleton mode={mode} />}
                appearance={clerkAppearance}
                routing="path"
                path={authRoutes.signIn}
                withSignUp={false}
                signUpUrl={signUpUrl}
                forceRedirectUrl={destination}
                signUpForceRedirectUrl={destination}
              />
            ) : (
              <SignUp
                fallback={<AuthFormSkeleton mode={mode} />}
                appearance={clerkAppearance}
                routing="path"
                path={authRoutes.signUp}
                signInUrl={signInUrl}
                forceRedirectUrl={destination}
                signInForceRedirectUrl={destination}
              />
            )}
          </ClerkLoaded>
        </>
      )}
    </div>
  );
}
