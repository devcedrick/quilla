export const authRoutes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  dashboard: "/dashboard",
} as const;

/** Only known application destinations are valid after authentication. */
export function safeReturnTo(value: unknown, origin?: string): string {
  if (
    typeof value !== "string" ||
    !value ||
    /[\\\s\u0000-\u001f\u007f]/.test(value)
  ) {
    return authRoutes.dashboard;
  }
  if (value.startsWith("//")) return authRoutes.dashboard;
  try {
    const base = origin ? new URL(origin) : new URL("https://quilla.invalid");
    const destination = new URL(value, base);
    if (
      destination.origin !== base.origin ||
      destination.username ||
      destination.password
    ) {
      return authRoutes.dashboard;
    }
    // Reject encoded path separators/control characters before checking the namespace.
    const path = decodeURIComponent(destination.pathname);
    if (
      /[\\\s\u0000-\u001f\u007f]/.test(path) ||
      path !== destination.pathname
    ) {
      return authRoutes.dashboard;
    }
    if (!(
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/admin" ||
      path.startsWith("/admin/")
    )) {
      return authRoutes.dashboard;
    }
    return `${path}${destination.search}${destination.hash}`;
  } catch {
    return authRoutes.dashboard;
  }
}

export function signInDestination(returnTo: string): string {
  return `${authRoutes.signIn}?${new URLSearchParams({ redirect_url: safeReturnTo(returnTo) })}`;
}
