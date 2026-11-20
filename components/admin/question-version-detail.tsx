"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { difficultyLabels } from "@/lib/admin/question-options";
import { AdminLoading, AdminQueryBoundary, StateBadge } from "./admin-ui";
import { ModerationActions } from "./moderation-actions";
import { QuestionContentPreview } from "./question-content-preview";
import { ReferencePreview } from "./reference-preview";

function isoDate(value: number) {
  return new Date(value).toISOString();
}

function ReviewHistory({
  reviews,
  overflow,
}: {
  reviews: Doc<"questionReviews">[];
  overflow: boolean;
}) {
  return (
    <section
      aria-labelledby="review-history-title"
      className="space-y-4 rounded-2xl border border-border bg-background p-5"
    >
      <div>
        <h2
          id="review-history-title"
          className="font-heading text-xl font-semibold"
        >
          Immutable review history
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Decisions are version-specific and are never edited or deleted.
        </p>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No review decisions recorded for this version.
        </p>
      ) : (
        <ol className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review._id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">
                  {review.kind === "review"
                    ? review.decision.replaceAll("_", " ")
                    : review.kind === "duplicate_recheck"
                      ? "Duplicate recheck"
                      : "Bootstrap acceptance"}
                </h3>
                <time
                  dateTime={isoDate(review.decidedAt)}
                  className="text-xs text-muted-foreground"
                >
                  {isoDate(review.decidedAt)}
                </time>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-muted-foreground">Reviewer</dt>
                  <dd className="break-all">{review.reviewerId}</dd>
                </div>
                <div>
                  <dt className="font-bold text-muted-foreground">
                    Workflow revision
                  </dt>
                  <dd>
                    {review.expectedRevision} → {review.resultingRevision}
                  </dd>
                </div>
                {review.kind !== "bootstrap_acceptance" && (
                  <>
                    <div>
                      <dt className="font-bold text-muted-foreground">
                        Duplicate disposition
                      </dt>
                      <dd>
                        {review.duplicateDisposition.replaceAll("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-muted-foreground">
                        Candidate fingerprint
                      </dt>
                      <dd className="break-all font-mono">
                        {review.candidateFingerprint}
                      </dd>
                    </div>
                  </>
                )}
                {review.kind === "bootstrap_acceptance" && (
                  <div>
                    <dt className="font-bold text-muted-foreground">
                      Bootstrap run
                    </dt>
                    <dd className="break-all font-mono">
                      {review.importRunId}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {review.reason}
              </p>
              {"score" in review && (
                <p className="mt-2 text-sm font-bold">
                  Quality score: {review.score}/5
                </p>
              )}
              {"assessment" in review && (
                <ol className="mt-3 space-y-1 text-xs">
                  {review.assessment.map((assessment, index) => (
                    <li key={index}>
                      <span
                        className={
                          assessment.passed
                            ? "font-bold text-primary"
                            : "font-bold text-destructive"
                        }
                      >
                        {assessment.passed ? "Passed" : "Failed"}
                      </span>{" "}
                      — {assessment.evidence}
                    </li>
                  ))}
                </ol>
              )}
              {review.kind !== "bootstrap_acceptance" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Duplicate evidence: {review.duplicateEvidence}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {overflow && (
        <p role="status" className="text-xs text-muted-foreground">
          Review history is truncated to the latest 50 decisions.
        </p>
      )}
    </section>
  );
}

function QuestionVersionDetail({ versionId }: { versionId: string }) {
  const context = useQuery(api.questions.getAdminVersion, {
    questionVersionId: versionId,
  });
  const history = useQuery(
    api.questions.listAdminQuestionVersions,
    context ? { questionId: context.question._id } : "skip",
  );
  if (context === undefined)
    return <AdminLoading>Loading the question version…</AdminLoading>;
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
  const { version, question, taxonomy, reference, reviews, duplicates } =
    context;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/questions"
            className="inline-flex min-h-11 items-center text-xs font-bold text-primary underline underline-offset-4"
          >
            ← Question bank
          </Link>
          <h2 className="mt-1 break-all font-heading text-3xl font-semibold">
            {question.questionId}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable version {version.version} · workflow revision{" "}
            {version.workflowRevision}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StateBadge state={version.state} />
          <Link
            href={`/admin/questions/${version._id}/revise`}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Create new version
          </Link>
        </div>
      </div>
      <dl className="grid gap-3 rounded-2xl border border-border bg-background p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Contributor
          </dt>
          <dd className="break-all font-mono text-xs">
            {question.contributorId}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Version creator
          </dt>
          <dd className="break-all font-mono text-xs">{version.creatorId}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Created
          </dt>
          <dd>
            <time dateTime={isoDate(version.createdAt)}>
              {isoDate(version.createdAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Difficulty
          </dt>
          <dd>{difficultyLabels[version.content.difficulty]}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Content hash
          </dt>
          <dd className="break-all font-mono text-xs">{version.contentHash}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Content fingerprint
          </dt>
          <dd className="break-all font-mono text-xs">
            {version.contentFingerprint}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Taxonomy catalog
          </dt>
          <dd>
            {taxonomy
              ? `${taxonomy.taxonomyId} · revision ${taxonomy.revision} · ${taxonomy.state}`
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Approval decision
          </dt>
          <dd className="break-all font-mono text-xs">
            {version.approvalDecisionId ?? "None"}
          </dd>
        </div>
      </dl>
      <ModerationActions
        version={version}
        question={question}
        reviews={reviews}
        duplicates={duplicates}
      />
      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <QuestionContentPreview content={version.content} />
          {reference && <ReferencePreview referenceVersionId={reference._id} />}
          <ReviewHistory reviews={reviews} overflow={context.reviewOverflow} />
        </div>
        <aside className="min-w-0 space-y-5">
          <section
            aria-labelledby="version-history-title"
            className="rounded-2xl border border-border bg-background p-5"
          >
            <h2
              id="version-history-title"
              className="font-heading text-xl font-semibold"
            >
              Immutable version history
            </h2>
            {history === undefined ? (
              <AdminLoading>Loading version history…</AdminLoading>
            ) : history === null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Version history is unavailable.
              </p>
            ) : (
              <>
                <ol className="mt-3 space-y-2">
                  {history.versions.map((item) => (
                    <li key={item._id}>
                      <Link
                        href={`/admin/questions/${item._id}`}
                        prefetch={false}
                        aria-current={
                          item._id === version._id ? "page" : undefined
                        }
                        className={
                          item._id === version._id
                            ? "block rounded-xl border border-primary bg-primary/5 p-3"
                            : "block rounded-xl border border-border p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        }
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold">
                            Version {item.version}
                          </span>
                          <StateBadge state={item.state} />
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {isoDate(item.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {history.overflow && (
                  <p
                    role="status"
                    className="mt-3 text-xs text-muted-foreground"
                  >
                    Only the latest 100 versions are shown.
                  </p>
                )}
              </>
            )}
          </section>
          <section
            aria-labelledby="duplicate-candidates-title"
            className="rounded-2xl border border-border bg-background p-5"
          >
            <h2
              id="duplicate-candidates-title"
              className="font-heading text-xl font-semibold"
            >
              Duplicate candidates
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Exact-fingerprint canonical questions in the current bounded scan.
            </p>
            {duplicates.ids.length ? (
              <ul className="mt-3 list-disc break-all pl-5 text-xs">
                {duplicates.ids.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">None found.</p>
            )}
            {duplicates.overflow && (
              <p role="status" className="mt-2 text-xs text-destructive">
                Candidate scan overflowed and is truncated.
              </p>
            )}
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              {duplicates.fingerprint}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function QuestionVersionDetailPage({
  versionId,
}: {
  versionId: string;
}) {
  return (
    <AdminQueryBoundary>
      <QuestionVersionDetail versionId={versionId} />
    </AdminQueryBoundary>
  );
}
