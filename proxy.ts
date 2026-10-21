import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getClerkConfiguration } from "@/lib/auth/configuration.server";
import { authRoutes } from "@/lib/auth/routes";

getClerkConfiguration();

export default clerkMiddleware(
  (_auth, request) => {
    const headers = new Headers(request.headers);
    // Always overwrite caller-supplied values. These are routing context, not authorization.
    headers.set("x-quilla-origin", request.nextUrl.origin);
    headers.set(
      "x-quilla-return-to",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const response = NextResponse.next({ request: { headers } });
    if (
      /^\/(dashboard|admin|sign-in|sign-up)(\/|$)/.test(
        request.nextUrl.pathname,
      )
    ) {
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  },
  { signInUrl: authRoutes.signIn, signUpUrl: authRoutes.signUp },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
