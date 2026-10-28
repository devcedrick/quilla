import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { authRoutes } from "@/lib/auth/routes";
import {
  landingAction,
  type LandingPlacement,
  type LandingSessionState,
} from "@/lib/auth/landing-action";
import { cn } from "@/lib/utils";

const primaryLink =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-[0_5px_0_var(--color-ink-shadow)] transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_7px_0_var(--color-ink-shadow)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-0 active:shadow-[0_3px_0_var(--color-ink-shadow)]";
const signInLink =
  "inline-flex min-h-11 items-center rounded-full px-3 text-base font-bold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const secondaryLink =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-background/75 px-5 py-3 text-sm font-bold text-foreground transition-colors hover:border-foreground/45 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function LandingAccountView({
  state,
  placement,
}: {
  state: LandingSessionState;
  placement: LandingPlacement;
}) {
  const action = landingAction(state, placement);
  const header = placement === "header";
  const primary = (
    <Link
      className={cn(
        primaryLink,
        header &&
          (state === "signed_out"
            ? "hidden text-base sm:inline-flex"
            : "px-3 text-xs sm:px-5 sm:text-base"),
      )}
      href={action.href}
      prefetch={false}
    >
      {action.label}
      {!header && <ArrowRight aria-hidden="true" className="size-4" />}
    </Link>
  );
  const secondary = action.secondary && (
    <Link
      className={header ? signInLink : secondaryLink}
      href={authRoutes.signIn}
      prefetch={false}
    >
      {action.secondary}
    </Link>
  );
  if (header)
    return (
      <>
        {secondary}
        {primary}
      </>
    );
  if (placement === "hero") return primary;
  return (
    <>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
        {action.description}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {primary}
        {secondary}
      </div>
    </>
  );
}
