"use client";

import { SignOutButton } from "@clerk/nextjs";

export function SignOut() {
  return (
    <SignOutButton redirectUrl="/">
      <button className="min-h-11 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        Sign out
      </button>
    </SignOutButton>
  );
}
