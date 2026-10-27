import Link from "next/link";
import { SignOut } from "./sign-out";

export function SuspendedAccount() {
  return (
    <section className="space-y-5" aria-label="Account access">
      <p role="alert">Your Quilla account is suspended.</p>
      <p>Learning features are unavailable. You can return home or sign out.</p>
      <Link className="underline underline-offset-4" href="/">
        Back to home
      </Link>
      <div>
        <SignOut />
      </div>
    </section>
  );
}

export function AccountAccessPending() {
  return <p role="status">Checking your Quilla account…</p>;
}

export function AccountAccessFailure({ retry }: { retry: () => void }) {
  return (
    <section className="space-y-5" aria-label="Account access">
      <p role="alert">
        We could not verify account access. Please try again or return home.
      </p>
      <button
        onClick={retry}
        className="min-h-11 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        Try again
      </button>
      <div>
        <Link className="underline underline-offset-4" href="/">
          Back to home
        </Link>
      </div>
      <SignOut />
    </section>
  );
}
