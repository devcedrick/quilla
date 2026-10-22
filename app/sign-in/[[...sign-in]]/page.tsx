import type { Metadata } from "next";
import { AccountPage } from "@/components/auth/account-page";

export const metadata: Metadata = {
  title: "Sign in | Quilla",
  robots: { index: false, follow: false },
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountPage mode="sign-in" searchParams={searchParams} />;
}
