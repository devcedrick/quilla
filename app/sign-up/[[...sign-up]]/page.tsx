import type { Metadata } from "next";
import { AccountPage } from "@/components/auth/account-page";

export const metadata: Metadata = {
  title: "Create an account | Quilla",
  robots: { index: false, follow: false },
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountPage mode="sign-up" searchParams={searchParams} />;
}
