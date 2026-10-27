"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AccountAccessFailure,
  AccountAccessPending,
  SuspendedAccount,
} from "./account-access-status";

class AccessErrorBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <AccountAccessFailure retry={this.props.retry} />
    ) : (
      this.props.children
    );
  }
}

function ProfileBootstrap() {
  const ensure = useMutation(api.users.ensureCurrentUser);
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void ensure({}).then(
      () => router.refresh(),
      () => setFailed(true),
    );
  }, [ensure, router, attempt]);
  if (failed)
    return (
      <AccountAccessFailure
        retry={() => {
          started.current = false;
          setFailed(false);
          setAttempt((value) => value + 1);
        }}
      />
    );
  return <AccountAccessPending />;
}

function LiveAccess({
  expectedUserId,
  children,
}: {
  expectedUserId?: Id<"users">;
  children?: ReactNode;
}) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const access = useQuery(
    api.users.currentAccess,
    !isLoading && isAuthenticated ? {} : "skip",
  );
  const router = useRouter();
  const refreshing = useRef(false);
  const mustRefresh =
    !isLoading &&
    isAuthenticated &&
    access?.status === "active" &&
    access.userId !== expectedUserId;
  useEffect(() => {
    if (mustRefresh && !refreshing.current) {
      refreshing.current = true;
      router.refresh();
    }
  }, [mustRefresh, router]);

  if (isLoading) return <AccountAccessPending />;
  if (!isAuthenticated)
    return <AccountAccessFailure retry={() => router.refresh()} />;
  if (!access) return <AccountAccessPending />;
  if (access.status === "suspended") return <SuspendedAccount />;
  if (access.status === "missing_profile") return <ProfileBootstrap />;
  if (mustRefresh) return <AccountAccessPending />;
  return children;
}

export function ApplicationAccessBoundary(props: {
  expectedUserId?: Id<"users">;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  return (
    <AccessErrorBoundary
      key={attempt}
      retry={() => {
        setAttempt((value) => value + 1);
        router.refresh();
      }}
    >
      <LiveAccess {...props} />
    </AccessErrorBoundary>
  );
}
