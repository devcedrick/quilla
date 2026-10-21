import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session.server";

export default function ReservedAdminPage() {
  return (
    <Suspense fallback={<p role="status">Checking access…</p>}>
      <ReservedAdminContent />
    </Suspense>
  );
}

async function ReservedAdminContent() {
  await requireSession("/admin");
  // Authentication alone never grants an admin role. #22 must add authorization.
  return notFound();
}
