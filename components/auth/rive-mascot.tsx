"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentType, ReactNode } from "react";

type RuntimeProps = {
  onReady: () => void;
  onFailure: () => void;
};
const query = "(prefers-reduced-motion: reduce)";
const serverSnapshot = () => false;
const motionAllowed = () => !window.matchMedia(query).matches;
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

class RuntimeBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function RiveLoader({ fallback }: { fallback: ReactNode }) {
  const [Runtime, setRuntime] = useState<ComponentType<RuntimeProps> | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const failed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFailure = useCallback(() => {
    failed.current = true;
    if (timer.current) clearTimeout(timer.current);
    setStatus("failed");
  }, []);
  const onReady = useCallback(() => {
    if (failed.current) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    timer.current = setTimeout(onFailure, 8000);
    import("./rive-welcome-runtime")
      .then((module) => {
        if (!cancelled && !failed.current)
          setRuntime(() => module.RiveWelcomeRuntime);
      })
      .catch(() => {
        if (!cancelled) onFailure();
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onFailure]);

  return (
    <div
      className="relative aspect-[1368/1150] w-full"
      data-testid="kuwi-rive"
      data-rive-state={status}
    >
      <div className={status === "ready" ? "invisible" : undefined}>
        {fallback}
      </div>
      {Runtime && status !== "failed" && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${status === "ready" ? "" : "invisible"}`}
        >
          <RuntimeBoundary onFailure={onFailure}>
            <Runtime onReady={onReady} onFailure={onFailure} />
          </RuntimeBoundary>
        </div>
      )}
    </div>
  );
}

export function RiveMascot({ fallback }: { fallback: ReactNode }) {
  const allowed = useSyncExternalStore(
    subscribe,
    motionAllowed,
    serverSnapshot,
  );
  return allowed ? (
    <RiveLoader fallback={fallback} />
  ) : (
    <div
      className="relative aspect-[1368/1150] w-full"
      data-testid="kuwi-rive"
      data-rive-state="fallback"
    >
      {fallback}
    </div>
  );
}
