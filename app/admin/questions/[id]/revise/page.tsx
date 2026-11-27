import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { QuestionRevisionForm } from "@/components/admin/question-revision-form";

export const metadata: Metadata = {
  title: "Revise question | Quilla admin",
  robots: { index: false, follow: false },
};

export default function AdminReviseQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading the source version…</p>}>
      <AdminReviseQuestionContent params={params} />
    </Suspense>
  );
}

async function AdminReviseQuestionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminGate
      returnTo={`/admin/questions/${id}/revise`}
      title="Revise question"
      description="Append a new immutable draft version. Existing versions, their served content, and their review decisions stay unchanged."
      current="questions"
    >
      <QuestionRevisionForm versionId={id} />
    </AdminGate>
  );
}
