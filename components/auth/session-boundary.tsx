"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { signInDestination } from "@/lib/auth/routes";

export function SessionBoundary({
  userId: expectedUserId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) router.replace(signInDestination("/dashboard"));
    else if (userId !== expectedUserId) router.refresh();
  }, [isLoaded, isSignedIn, userId, expectedUserId, router]);

  if (!isLoaded || !isSignedIn || userId !== expectedUserId) {
    return <p role="status">Checking your session…</p>;
  }
  return children;
}
