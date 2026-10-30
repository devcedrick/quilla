import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LockKeyhole,
  Settings2,
} from "lucide-react";
import { SignOut } from "@/components/auth/sign-out";
import { authRoutes } from "@/lib/auth/routes";
import {
  levelLabels,
  type ExamLevel,
  type PreparationPreferences,
} from "@/lib/preparation";
import { cn } from "@/lib/utils";

const navigation = [
  {
    href: authRoutes.dashboard,
    label: "Account overview",
    icon: LayoutDashboard,
  },
  { href: authRoutes.preferences, label: "Preferences", icon: Settings2 },
  {
    href: authRoutes.diagnostic,
    label: "Diagnostic next steps",
    icon: BookOpen,
  },
];

export function PreparationOverview({
  kind,
  preferences,
  children,
}: {
  kind: "dashboard" | "diagnostic";
  preferences: PreparationPreferences & { preferredLevel: ExamLevel };
  children: ReactNode;
}) {
  const level = preferences.preferredLevel;
  return (
    <section
      aria-label="Preparation status"
      data-preparation-panel=""
      className="grid lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <aside className="flex min-w-0 flex-col rounded-t-[1.7rem] bg-primary p-6 text-primary-foreground lg:rounded-tr-none lg:rounded-l-[1.7rem] lg:p-8">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Your next chapter
          </p>
          <p className="mt-4 font-heading text-3xl leading-tight">
            A little direction.
            <br />A steady pace.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/85">
            Keep your preparation in view, one thoughtful step at a time.
          </p>
        </div>
        <nav aria-label="Preparation navigation" className="lg:mt-9">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-3">
            {navigation.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={href === authRoutes[kind] ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none lg:text-sm",
                    href === authRoutes[kind]
                      ? "bg-accent text-accent-foreground"
                      : "text-primary-foreground hover:bg-primary-foreground/10",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto hidden pt-12 lg:block">
          <Image
            src="/brand/kuwi/kuwi-mark.svg"
            width={64}
            height={64}
            alt=""
            aria-hidden="true"
            className="mb-4 size-16 rounded-full bg-accent"
          />
          <p className="text-sm leading-relaxed">
            Your pace. Your next chapter.
          </p>
        </div>
      </aside>
      <div className="min-w-0 p-6 sm:p-8 lg:p-10">
        <header>
          <p
            data-testid="account-status"
            className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary"
            />
            You are signed in.
          </p>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {kind === "dashboard"
              ? "Your Quilla account"
              : "Your diagnostic next steps"}
          </p>
          <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {levelLabels[level]} preparation
          </h2>
        </header>
        <div className="mt-7 rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <CalendarDays
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-primary"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Target exam date
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {preferences.targetExamDate ? (
                    <time dateTime={preferences.targetExamDate}>
                      {preferences.targetExamDate}
                    </time>
                  ) : (
                    "No target exam date set."
                  )}
                </p>
              </div>
            </div>
            <Link
              href={authRoutes.preferences}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-bold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Edit preparation preferences
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </div>
          <p className="mt-4 border-t border-border/70 pt-4 text-sm leading-relaxed text-muted-foreground">
            {level === "professional"
              ? "Professional includes Analytical Ability and excludes Clerical Ability."
              : "Subprofessional includes Clerical Ability and excludes Analytical Ability."}
          </p>
        </div>
        <section
          aria-label="Diagnostic availability"
          className="mt-7 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-heading text-2xl font-semibold">
              {kind === "dashboard"
                ? "A look at what’s next"
                : "A starting point, not a score"}
            </h3>
            <span className="rounded-full bg-accent/35 px-3 py-1 text-xs font-semibold">
              Not available yet
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {kind === "dashboard"
              ? "Diagnostics and personalized study features are not available yet."
              : "A diagnostic will help identify strengths and learning gaps for your chosen level. The assessment is not available yet."}
          </p>
          <div className="flex items-start gap-3 rounded-xl bg-background p-4">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {children}
          </div>
          <Link
            href={
              kind === "dashboard"
                ? authRoutes.diagnostic
                : authRoutes.dashboard
            }
            prefetch={false}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none sm:w-auto"
          >
            {kind === "dashboard"
              ? "View diagnostic next steps"
              : "Go to your dashboard"}
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        </section>
        <footer className="mt-7 flex items-center justify-between gap-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
          <span>Room to grow. No need to rush.</span>
          <SignOut variant="text" />
        </footer>
      </div>
    </section>
  );
}
