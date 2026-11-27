"use client";

import {
  Component,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { AdminQuestionState } from "@/lib/admin/question-options";
import { stateLabels } from "@/lib/admin/question-options";
import { cn } from "@/lib/utils";

export const adminControlClass =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60";

export function adminDescribedBy(id: string, hint?: string, error?: string) {
  return (
    [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function AdminField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const buttonVariants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-foreground focus-visible:outline-primary",
  secondary:
    "border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-ring",
  danger:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-destructive",
  quiet:
    "text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-ring",
};

export function AdminButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

const stateTones: Record<AdminQuestionState, string> = {
  draft: "border-border bg-muted text-foreground",
  pending_review: "border-accent bg-accent/30 text-foreground",
  needs_revision: "border-destructive/40 bg-destructive/10 text-destructive",
  approved: "border-primary/40 bg-primary/10 text-primary",
  published: "border-primary bg-primary text-primary-foreground",
  rejected: "border-destructive bg-destructive/15 text-destructive",
  archived: "border-border bg-background text-muted-foreground",
};

export function StateBadge({ state }: { state: AdminQuestionState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
        stateTones[state],
      )}
    >
      {stateLabels[state]}
    </span>
  );
}

class Boundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section aria-label="Admin data error" className="space-y-4 py-6">
        <p role="alert">
          We could not load the requested admin data. Try again.
        </p>
        <AdminButton variant="secondary" onClick={this.props.retry}>
          Try again
        </AdminButton>
      </section>
    );
  }
}

export function AdminQueryBoundary({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Boundary key={attempt} retry={() => setAttempt((value) => value + 1)}>
      {children}
    </Boundary>
  );
}

export function AdminLoading({
  children = "Loading…",
}: {
  children?: ReactNode;
}) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}
