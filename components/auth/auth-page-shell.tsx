import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WelcomeMascot } from "./welcome-mascot";

const accountLink =
  "inline-flex min-h-11 items-center rounded-md text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none";

function BrandLink() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
    >
      <Image
        src="/brand/kuwi/kuwi-mark.svg"
        width={36}
        height={36}
        alt=""
        aria-hidden="true"
        className="size-9"
      />
      <span className="font-heading text-[1.8rem] font-black tracking-[-0.04em]">
        Quilla
      </span>
    </Link>
  );
}

export function AuthPageShell({
  title,
  children,
  layout = "compact",
}: {
  title: string;
  children: ReactNode;
  layout?: "auth" | "compact" | "preparation";
}) {
  const isAuth = layout === "auth";
  const isPreparation = layout === "preparation";
  return (
    <div
      className="paper-grid flex min-h-dvh flex-col bg-background px-3 py-4 font-sans text-foreground sm:px-6 sm:py-6 lg:px-10 lg:py-8"
      data-account-layout={layout}
    >
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-4 z-50 rounded-xl bg-foreground px-5 py-3 font-bold text-background focus:not-sr-only focus:outline-2 focus:outline-offset-4 focus:outline-primary"
      >
        Skip to main content
      </a>
      {!isAuth && (
        <header className="mx-auto flex w-full max-w-[76rem] items-center justify-between px-3 pb-8">
          <BrandLink />
          <Link href="/" className={accountLink}>
            Back to home
          </Link>
        </header>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        data-testid="account-composition"
        className={cn(
          "mx-auto my-auto w-full outline-none",
          isAuth
            ? "grid max-w-[76rem] rounded-[2rem] border border-foreground/8 bg-card p-2 shadow-[0_24px_80px_-32px_color-mix(in_oklch,var(--foreground)_25%,transparent)] lg:grid-cols-2 lg:rounded-[2.25rem]"
            : cn(
                "rounded-[1.75rem] border border-foreground/10 bg-card shadow-[0_16px_60px_-28px_color-mix(in_oklch,var(--foreground)_20%,transparent)]",
                isPreparation ? "max-w-[64rem]" : "max-w-lg p-7 sm:p-10",
              ),
        )}
      >
        {isAuth && (
          <aside
            aria-label="Welcome to Quilla"
            data-testid="auth-welcome"
            className="relative isolate flex flex-col rounded-[1.75rem] px-5 pt-4 lg:min-h-[44rem] lg:px-10 lg:py-9 xl:px-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden rounded-[1.75rem] lg:block"
              style={{
                background:
                  "radial-gradient(ellipse at 85% 15%, color-mix(in oklch, var(--primary) 95%, transparent), transparent 65%), linear-gradient(155deg, var(--foreground), var(--primary))",
              }}
            >
              <div className="absolute -top-40 -right-40 size-[36rem] rounded-full border border-primary-foreground/10" />
              <div className="absolute -top-24 -right-24 size-[28rem] rounded-full border border-primary-foreground/10" />
            </div>
            <div className="lg:text-primary-foreground">
              <BrandLink />
            </div>
            <div className="absolute top-2 right-4 w-16 lg:relative lg:top-auto lg:right-auto lg:mx-auto lg:mt-5 lg:flex lg:w-full lg:max-w-[23rem] lg:flex-1 lg:items-center lg:justify-center">
              <div
                aria-hidden="true"
                data-testid="auth-mascot-backdrop"
                className="pointer-events-none absolute top-1/2 left-1/2 -z-10 hidden aspect-square w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent lg:block"
              />
              <WelcomeMascot />
            </div>
            <div className="hidden pb-1 lg:block lg:text-primary-foreground">
              <h2 className="max-w-sm font-heading text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-[3.5rem]">
                A steady start.
              </h2>
              <p className="mt-4 max-w-xs text-base leading-relaxed">
                Take your next step with Quilla.
              </p>
              <div className="mt-8 border-t border-primary-foreground/20 pt-5 text-xs leading-relaxed">
                Your pace. Your next chapter.
              </div>
            </div>
          </aside>
        )}
        <section
          aria-labelledby="account-title"
          className={cn(
            "min-w-0",
            isPreparation && "p-6 sm:p-8 has-[[data-preparation-panel]]:p-0",
            isAuth &&
              "flex flex-col px-5 pt-3 pb-5 sm:px-10 sm:pb-8 lg:px-12 lg:pt-5 xl:px-16",
          )}
        >
          {isAuth && (
            <div className="mb-7 flex min-h-11 justify-end lg:mb-10">
              <Link href="/" className={accountLink}>
                Back to home{" "}
                <span aria-hidden="true" className="ml-2">
                  ↗
                </span>
              </Link>
            </div>
          )}
          <div
            className={cn(
              "w-full min-w-0",
              isAuth && "mx-auto my-auto max-w-[25rem]",
            )}
          >
            <h1
              id="account-title"
              className={cn(
                "font-heading font-semibold tracking-[-0.035em]",
                isAuth || isPreparation
                  ? "sr-only"
                  : "mb-6 text-3xl leading-tight sm:text-4xl",
              )}
            >
              {title}
            </h1>
            {children}
          </div>
          {!isAuth && !isPreparation && (
            <nav
              aria-label="Account navigation"
              className={cn(
                "flex flex-wrap justify-center gap-x-5 gap-y-0",
                isAuth
                  ? "mt-8 lg:mt-10"
                  : "mt-7 border-t border-border/50 pt-4",
              )}
            >
              <Link href="/sign-in" prefetch={false} className={accountLink}>
                Sign in
              </Link>
              <Link href="/sign-up" prefetch={false} className={accountLink}>
                Create an account
              </Link>
              <Link href="/dashboard" prefetch={false} className={accountLink}>
                Your account
              </Link>
            </nav>
          )}
        </section>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-3 pt-6 text-center text-[0.6875rem] leading-relaxed text-muted-foreground">
        Quilla is an independent learning platform. It is not affiliated with,
        endorsed by, or connected to the Philippine Civil Service Commission.
      </footer>
    </div>
  );
}
