import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-5 py-5">
        <Link
          href="/"
          className="rounded font-heading text-2xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Quilla
        </Link>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-10 sm:px-8"
      >
        <h1 className="text-center font-heading text-3xl font-bold">{title}</h1>
        <div className="w-full min-w-0">{children}</div>
        <nav
          aria-label="Account navigation"
          className="flex flex-wrap justify-center gap-5 text-sm"
        >
          <Link
            href="/sign-in"
            prefetch={false}
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            prefetch={false}
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Create an account
          </Link>
          <Link
            href="/dashboard"
            prefetch={false}
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Your account
          </Link>
          <Link
            href="/"
            className="rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to home
          </Link>
        </nav>
      </main>
      <footer className="mx-auto max-w-xl px-6 pb-8 text-center text-xs leading-relaxed text-muted-foreground">
        Quilla is an independent learning platform. It is not affiliated with,
        endorsed by, or connected to the Philippine Civil Service Commission.
      </footer>
    </div>
  );
}
