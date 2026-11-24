"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminLoading, AdminQueryBoundary } from "./admin-ui";
import { QuestionForm } from "./question-form";

function RevisionForm({ versionId }: { versionId: string }) {
  const context = useQuery(api.questions.getAdminVersion, {
    questionVersionId: versionId,
  });
  if (context === undefined)
    return <AdminLoading>Loading the source version…</AdminLoading>;
  if (context === null)
    return (
      <section className="space-y-4">
        <p role="alert">This question version could not be found.</p>
        <Link
          href="/admin/questions"
          className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
        >
          Back to the question bank
        </Link>
      </section>
    );
  return (
    <>
      {context.version.version !== context.question.latestVersion && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-accent bg-accent/10 p-4 text-sm"
        >
          You are revising version {context.version.version}. The new draft is
          appended after the latest version and does not change any existing
          version.
        </p>
      )}
      <QuestionForm
        mode="revise"
        sourceTaxonomySealed={context.taxonomy?.state === "sealed"}
        initial={{ question: context.question, version: context.version }}
      />
    </>
  );
}

export function QuestionRevisionForm({ versionId }: { versionId: string }) {
  return (
    <AdminQueryBoundary>
      <RevisionForm versionId={versionId} />
    </AdminQueryBoundary>
  );
}
