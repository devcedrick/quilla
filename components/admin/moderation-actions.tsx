"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";
import { rubricCriteria } from "@/lib/admin/question-options";
import {
  AdminButton,
  AdminField,
  adminControlClass,
  adminDescribedBy,
} from "./admin-ui";

type DuplicateDisposition =
  "none_found" | "adjudicated_distinct" | "unresolved";
type Decision = "approve" | "needs_revision" | "reject";

const dispositionLabels: Record<DuplicateDisposition, string> = {
  none_found: "No duplicate candidates found",
  adjudicated_distinct: "Candidates reviewed and all are distinct",
  unresolved: "Duplicate risk remains unresolved",
};

export function ModerationActions({
  version,
  question,
  reviews,
  duplicates,
}: {
  version: Doc<"questionVersions">;
  question: Doc<"questions">;
  reviews: Doc<"questionReviews">[];
  duplicates: {
    ids: Id<"questions">[];
    fingerprint: string;
    overflow: boolean;
  };
}) {
  const access = useQuery(api.users.currentAccess, {});
  const submit = useMutation(api.questions.submitForReview);
  const review = useMutation(api.questions.reviewVersion);
  const publish = useMutation(api.questions.publishVersion);
  const archive = useMutation(api.questions.archiveVersion);
  const recheck = useMutation(api.questions.reviewDuplicateCandidates);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [decision, setDecision] = useState<Decision>("approve");
  const [reason, setReason] = useState("");
  const [assessments, setAssessments] = useState(
    rubricCriteria.map(() => ({ passed: false, evidence: "" })),
  );
  const [disposition, setDisposition] = useState<DuplicateDisposition>(
    duplicates.ids.length ? "unresolved" : "none_found",
  );
  const [duplicateEvidence, setDuplicateEvidence] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [recheckOpen, setRecheckOpen] = useState(false);
  const [recheckDisposition, setRecheckDisposition] =
    useState<DuplicateDisposition>(
      duplicates.ids.length ? "adjudicated_distinct" : "none_found",
    );
  const [recheckEvidence, setRecheckEvidence] = useState("");
  const [recheckError, setRecheckError] = useState<string | null>(null);

  const currentUserId = access?.status === "active" ? access.userId : undefined;
  const independent =
    Boolean(currentUserId) &&
    currentUserId !== question.contributorId &&
    currentUserId !== version.creatorId;
  const canSubmit =
    Boolean(currentUserId) &&
    (currentUserId === question.contributorId ||
      currentUserId === version.creatorId);
  const approval = version.approvalDecisionId
    ? reviews.find((item) => item._id === version.approvalDecisionId)
    : undefined;
  const approvalFingerprint =
    approval && approval.kind !== "bootstrap_acceptance"
      ? approval.candidateFingerprint
      : undefined;
  const matchingRecheck = reviews.find(
    (item) =>
      item.kind === "duplicate_recheck" &&
      item.candidateFingerprint === duplicates.fingerprint &&
      item.duplicateDisposition !== "unresolved",
  );
  const duplicatesChanged =
    approvalFingerprint !== undefined &&
    approvalFingerprint !== duplicates.fingerprint &&
    !matchingRecheck;

  async function run(
    name: string,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setPending(name);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(
        adminErrorMessage(
          caught,
          "The moderation action could not be completed. Try again.",
        ),
      );
    } finally {
      setPending(null);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextErrors: Record<string, string> = {};
    assessments.forEach((assessment, index) => {
      if (!assessment.evidence.trim())
        nextErrors[`evidence-${index}`] = "Evidence is required.";
      if (decision === "approve" && !assessment.passed)
        nextErrors[`pass-${index}`] =
          "Approval requires all five criteria to pass.";
    });
    if (decision !== "approve" && !reason.trim())
      nextErrors.reason = "A nonblank reason is required.";
    if (!duplicateEvidence.trim())
      nextErrors.duplicateEvidence = "Duplicate evidence is required.";
    if (decision === "approve" && duplicates.overflow)
      nextErrors.form =
        "Approval is blocked because the duplicate candidate scan overflowed. Reduce the duplicate set first.";
    if (decision === "approve" && disposition === "unresolved")
      nextErrors.form = "Unresolved duplicate risk blocks approval.";
    if (
      decision === "approve" &&
      duplicates.ids.length &&
      disposition !== "adjudicated_distinct"
    )
      nextErrors.form =
        "Approval requires the duplicate candidates to be adjudicated as distinct.";
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() =>
        document.getElementById("moderation-form-error")?.focus(),
      );
      return;
    }
    setPending("review");
    setError(null);
    setNotice(null);
    try {
      await review({
        questionVersionId: version._id,
        expectedWorkflowRevision: version.workflowRevision,
        decision,
        reason: reason.trim(),
        assessment: assessments.map((assessment) => ({
          passed: assessment.passed,
          evidence: assessment.evidence.trim(),
        })),
        duplicateDisposition: disposition,
        duplicateEvidence: duplicateEvidence.trim(),
      });
      setReviewOpen(false);
      setNotice(
        decision === "approve"
          ? "Independent approval recorded. The version can now be published."
          : decision === "reject"
            ? "Rejection recorded."
            : "Revision request recorded.",
      );
      setFormErrors({});
    } catch (caught) {
      setError(
        adminErrorMessage(
          caught,
          "The review decision could not be recorded. Try again.",
        ),
      );
    } finally {
      setPending(null);
    }
  }

  async function submitRecheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!recheckEvidence.trim()) {
      setRecheckError("Evidence is required.");
      return;
    }
    setPending("recheck");
    setError(null);
    setNotice(null);
    setRecheckError(null);
    try {
      await recheck({
        questionVersionId: version._id,
        expectedWorkflowRevision: version.workflowRevision,
        candidateSetFingerprint: duplicates.fingerprint,
        disposition: recheckDisposition,
        evidence: recheckEvidence.trim(),
      });
      setRecheckOpen(false);
      setNotice(
        recheckDisposition === "unresolved"
          ? "Duplicate recheck recorded as unresolved; publication remains blocked."
          : "Independent duplicate recheck recorded.",
      );
    } catch (caught) {
      setError(
        adminErrorMessage(
          caught,
          "The duplicate recheck could not be recorded. Reload and try again.",
        ),
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="moderation-actions-title"
      className="space-y-4 rounded-2xl border border-border bg-background p-5"
    >
      <div>
        <h2
          id="moderation-actions-title"
          className="font-heading text-xl font-semibold"
        >
          Lifecycle actions
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These controls only show currently allowed actions. The backend
          independently enforces authorization, revisions, quality criteria, and
          duplicate checks.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {version.state === "draft" &&
          (canSubmit ? (
            <AdminButton
              disabled={Boolean(pending)}
              onClick={() =>
                run(
                  "submit",
                  () =>
                    submit({
                      questionVersionId: version._id,
                      expectedWorkflowRevision: version.workflowRevision,
                    }),
                  "Draft submitted for independent review.",
                )
              }
            >
              {pending === "submit" ? "Submitting…" : "Submit for review"}
            </AdminButton>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only the contributor or version creator can submit this draft.
            </p>
          ))}
        {version.state === "pending_review" &&
          (independent ? (
            <AdminButton
              variant={reviewOpen ? "secondary" : "primary"}
              onClick={() => setReviewOpen((open) => !open)}
            >
              {reviewOpen ? "Close review form" : "Review this version"}
            </AdminButton>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              You cannot review this version because you are its contributor or
              creator. A different active admin must decide.
            </p>
          ))}
        {version.state === "approved" && (
          <>
            <AdminButton
              disabled={Boolean(pending) || duplicatesChanged}
              onClick={() =>
                run(
                  "publish",
                  () =>
                    publish({
                      questionVersionId: version._id,
                      expectedWorkflowRevision: version.workflowRevision,
                    }),
                  "Version published. Earlier versions remain unchanged.",
                )
              }
            >
              {pending === "publish" ? "Publishing…" : "Publish version"}
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={Boolean(pending)}
              onClick={() =>
                run(
                  "archive",
                  () =>
                    archive({
                      questionVersionId: version._id,
                      expectedWorkflowRevision: version.workflowRevision,
                    }),
                  "Version archived without deleting its history.",
                )
              }
            >
              {pending === "archive" ? "Archiving…" : "Archive version"}
            </AdminButton>
          </>
        )}
        {version.state === "published" && (
          <AdminButton
            variant="danger"
            disabled={Boolean(pending)}
            onClick={() =>
              run(
                "archive",
                () =>
                  archive({
                    questionVersionId: version._id,
                    expectedWorkflowRevision: version.workflowRevision,
                  }),
                "Version archived without deleting its history.",
              )
            }
          >
            {pending === "archive" ? "Archiving…" : "Archive version"}
          </AdminButton>
        )}
        {["needs_revision", "rejected", "archived"].includes(version.state) && (
          <p className="text-sm text-muted-foreground">
            No further lifecycle action is available for this version. Create a
            new immutable revision to continue authoring.
          </p>
        )}
      </div>
      {version.state === "approved" && duplicatesChanged && (
        <div className="space-y-3 rounded-xl border border-accent bg-accent/10 p-4">
          <p role="alert" className="text-sm">
            The duplicate candidate set changed after approval. Publishing is
            blocked until a different active admin records a duplicate recheck
            for fingerprint{" "}
            <code className="break-all">{duplicates.fingerprint}</code>.
          </p>
          {independent ? (
            recheckOpen ? (
              <form onSubmit={submitRecheck} noValidate className="space-y-3">
                <AdminField
                  id="recheck-disposition"
                  label="Recheck disposition"
                  required
                >
                  <select
                    id="recheck-disposition"
                    value={recheckDisposition}
                    disabled={Boolean(pending)}
                    onChange={(event) =>
                      setRecheckDisposition(
                        event.target.value as DuplicateDisposition,
                      )
                    }
                    className={adminControlClass}
                  >
                    {Object.entries(dispositionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField
                  id="recheck-evidence"
                  label="Recheck evidence"
                  required
                  error={recheckError ?? undefined}
                >
                  <textarea
                    id="recheck-evidence"
                    rows={3}
                    value={recheckEvidence}
                    disabled={Boolean(pending)}
                    onChange={(event) => setRecheckEvidence(event.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(recheckError)}
                    aria-describedby={adminDescribedBy(
                      "recheck-evidence",
                      undefined,
                      recheckError ?? undefined,
                    )}
                    className={adminControlClass}
                  />
                </AdminField>
                <div className="flex flex-wrap gap-3">
                  <AdminButton type="submit" disabled={Boolean(pending)}>
                    {pending === "recheck"
                      ? "Recording…"
                      : "Record duplicate recheck"}
                  </AdminButton>
                  <AdminButton
                    variant="secondary"
                    disabled={Boolean(pending)}
                    onClick={() => setRecheckOpen(false)}
                  >
                    Cancel
                  </AdminButton>
                </div>
              </form>
            ) : (
              <AdminButton
                variant="secondary"
                disabled={Boolean(pending)}
                onClick={() => setRecheckOpen(true)}
              >
                Record duplicate recheck
              </AdminButton>
            )
          ) : (
            <p className="text-sm">
              A different active admin must record the duplicate recheck.
            </p>
          )}
        </div>
      )}
      {version.state === "pending_review" && reviewOpen && independent && (
        <form
          onSubmit={submitReview}
          noValidate
          aria-busy={pending === "review"}
          className="space-y-5 border-t border-border/70 pt-5"
        >
          <fieldset className="space-y-3">
            <legend className="font-heading text-lg font-semibold">
              Decision
            </legend>
            {(
              [
                ["approve", "Approve"],
                ["needs_revision", "Request revision"],
                ["reject", "Reject"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="moderation-decision"
                  value={value}
                  checked={decision === value}
                  disabled={Boolean(pending)}
                  onChange={() => setDecision(value)}
                  className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                />
                <span className="text-sm font-bold">{label}</span>
              </label>
            ))}
          </fieldset>
          <AdminField
            id="moderation-reason"
            label={
              decision === "approve"
                ? "Review note (optional for approval)"
                : "Reason"
            }
            required={decision !== "approve"}
            error={formErrors.reason}
          >
            <textarea
              id="moderation-reason"
              rows={3}
              value={reason}
              disabled={Boolean(pending)}
              onChange={(event) => setReason(event.target.value)}
              aria-required={decision !== "approve"}
              aria-invalid={Boolean(formErrors.reason)}
              aria-describedby={adminDescribedBy(
                "moderation-reason",
                undefined,
                formErrors.reason,
              )}
              className={adminControlClass}
            />
          </AdminField>
          <fieldset className="space-y-4">
            <legend className="font-heading text-lg font-semibold">
              Editorial quality rubric
            </legend>
            <p className="text-xs text-muted-foreground">
              Each criterion needs nonblank evidence. Approval requires all five
              to pass; the server computes the score.
            </p>
            {rubricCriteria.map((criterion, index) => (
              <div
                key={criterion}
                className="space-y-2 rounded-xl border border-border p-3"
              >
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={assessments[index].passed}
                    disabled={Boolean(pending)}
                    onChange={(event) =>
                      setAssessments((current) =>
                        current.map((assessment, assessmentIndex) =>
                          assessmentIndex === index
                            ? { ...assessment, passed: event.target.checked }
                            : assessment,
                        ),
                      )
                    }
                    aria-invalid={Boolean(formErrors[`pass-${index}`])}
                    className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  />
                  <span className="text-sm font-bold">
                    {index + 1}. {criterion}
                    {formErrors[`pass-${index}`] && (
                      <span className="mt-1 block text-xs text-destructive">
                        {formErrors[`pass-${index}`]}
                      </span>
                    )}
                  </span>
                </label>
                <label
                  htmlFor={`assessment-evidence-${index}`}
                  className="block text-xs font-bold"
                >
                  Evidence for criterion {index + 1}
                </label>
                <textarea
                  id={`assessment-evidence-${index}`}
                  rows={2}
                  value={assessments[index].evidence}
                  disabled={Boolean(pending)}
                  onChange={(event) =>
                    setAssessments((current) =>
                      current.map((assessment, assessmentIndex) =>
                        assessmentIndex === index
                          ? { ...assessment, evidence: event.target.value }
                          : assessment,
                      ),
                    )
                  }
                  aria-required="true"
                  aria-invalid={Boolean(formErrors[`evidence-${index}`])}
                  className={adminControlClass}
                />
                {formErrors[`evidence-${index}`] && (
                  <p role="alert" className="text-xs text-destructive">
                    {formErrors[`evidence-${index}`]}
                  </p>
                )}
              </div>
            ))}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-heading text-lg font-semibold">
              Duplicate adjudication
            </legend>
            {duplicates.ids.length ? (
              <div className="text-sm">
                <p className="font-bold">
                  {duplicates.ids.length} exact-fingerprint candidate
                  {duplicates.ids.length === 1 ? "" : "s"}:
                </p>
                <ul className="mt-1 list-disc break-all pl-5 text-xs text-muted-foreground">
                  {duplicates.ids.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
                {duplicates.overflow && (
                  <p role="alert" className="mt-2 text-destructive">
                    The candidate scan is truncated. Approval is blocked until
                    the set is reduced.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No exact-fingerprint candidates were found in the current scan.
              </p>
            )}
            <AdminField id="duplicate-disposition" label="Disposition" required>
              <select
                id="duplicate-disposition"
                value={disposition}
                disabled={Boolean(pending)}
                onChange={(event) =>
                  setDisposition(event.target.value as DuplicateDisposition)
                }
                className={adminControlClass}
              >
                {Object.entries(dispositionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField
              id="duplicate-evidence"
              label="Duplicate evidence"
              required
              error={formErrors.duplicateEvidence}
            >
              <textarea
                id="duplicate-evidence"
                rows={3}
                value={duplicateEvidence}
                disabled={Boolean(pending)}
                onChange={(event) => setDuplicateEvidence(event.target.value)}
                aria-required="true"
                aria-invalid={Boolean(formErrors.duplicateEvidence)}
                aria-describedby={adminDescribedBy(
                  "duplicate-evidence",
                  undefined,
                  formErrors.duplicateEvidence,
                )}
                className={adminControlClass}
              />
            </AdminField>
          </fieldset>
          {formErrors.form && (
            <p
              id="moderation-form-error"
              role="alert"
              tabIndex={-1}
              className="rounded-xl border border-destructive p-3 text-sm"
            >
              {formErrors.form}
            </p>
          )}
          <AdminButton type="submit" disabled={Boolean(pending)}>
            {pending === "review" ? "Recording decision…" : "Record decision"}
          </AdminButton>
        </form>
      )}
    </section>
  );
}
