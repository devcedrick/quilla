import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { QuestionVersionDetailPage } from "@/components/admin/question-version-detail";

export const metadata: Metadata = {
  title: "Question version | Quilla admin",
  robots: { index: false, follow: false },
};

export default function AdminQuestionVersionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading the question version…</p>}>
      <AdminQuestionVersionContent params={params} />
    </Suspense>
  );
}

async function AdminQuestionVersionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminGate
      returnTo={`/admin/questions/${id}`}
      title="Question version"
      description="Inspect the exact immutable content, its review history, and only the lifecycle actions currently allowed for this version."
      current="questions"
    >
      <QuestionVersionDetailPage versionId={id} />
    </AdminGate>
  );
}
