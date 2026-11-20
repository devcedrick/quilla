import Link from "next/link";
import { BookOpenCheck, LayoutDashboard, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignOut } from "@/components/auth/sign-out";
import { cn } from "@/lib/utils";

export type AdminSection = "questions" | "new";

const navigation = [
  {
    href: "/admin/questions",
    label: "Question bank",
    icon: BookOpenCheck,
    section: "questions",
  },
  {
    href: "/admin/questions/new",
    label: "New question",
    icon: Plus,
    section: "new",
  },
] as const;

export function AdminShell({
  title,
  description,
  current,
  children,
}: {
  title: string;
  description: string;
  current: AdminSection;
  children: ReactNode;
}) {
  return (
    <AuthPageShell title={title} layout="admin">
      <header className="border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Admin workspace
            </p>
            <h1 className="mt-2 font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <LayoutDashboard aria-hidden="true" className="size-4" />
              Dashboard
            </Link>
            <SignOut variant="text" />
          </div>
        </div>
        <nav aria-label="Admin navigation" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {navigation.map(({ href, label, icon: Icon, section }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={section === current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
                    section === current
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div className="min-w-0 pt-6">{children}</div>
    </AuthPageShell>
  );
}
