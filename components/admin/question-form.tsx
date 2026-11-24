"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";
import {
  buildQuestionContent,
  firstAuthoringField,
  nextUnusedChoiceId,
  validateAuthoringDraft,
  type AuthoringChoice,
  type AuthoringDraft,
  type AuthoringErrors,
  authoringFieldIds,
} from "@/lib/admin/question-form";
import {
  difficultyOptions,
  levelLabels,
  moduleLabels,
  moduleLevels,
  moduleSubjectKeys,
  originOptions,
  type AdminQuestionDifficulty,
  type AdminQuestionLanguage,
  type AdminQuestionModule,
  type AdminQuestionOrigin,
} from "@/lib/admin/question-options";
import {
  AdminButton,
  AdminField,
  AdminLoading,
  adminControlClass,
  adminDescribedBy,
} from "./admin-ui";
import { ReferencePreview } from "./reference-preview";

type InitialVersion = {
  question: Doc<"questions">;
  version: Doc<"questionVersions">;
};

export function QuestionForm({
  mode,
  initial,
  sourceTaxonomySealed = true,
}: {
  mode: "create" | "revise";
  initial?: InitialVersion;
  /** A revision keeps its source catalog only while that catalog is sealed. */
  sourceTaxonomySealed?: boolean;
}) {
  const source = initial?.version.content;
  const [questionId, setQuestionId] = useState(
    initial?.question.questionId ?? "",
  );
  const [family, setFamily] = useState(source ? String(source.family) : "");
  const [module, setModule] = useState<AdminQuestionModule>(
    source?.module ?? "shared-core",
  );
  const [subjectId, setSubjectId] = useState(source?.subjectId ?? "");
  const [subtopicId, setSubtopicId] = useState(source?.subtopicId ?? "");
  const [conceptId, setConceptId] = useState(source?.conceptId ?? "");
  const [language, setLanguage] = useState<AdminQuestionLanguage>(
    source?.language ?? "english",
  );
  const [difficulty, setDifficulty] = useState<AdminQuestionDifficulty>(
    source?.difficulty ?? "easy",
  );
  const [stem, setStem] = useState(source?.stem ?? "");
  const [choices, setChoices] = useState<AuthoringChoice[]>(
    source?.choices ?? [
      { choiceId: "a", text: "" },
      { choiceId: "b", text: "" },
    ],
  );
  const [correctChoiceId, setCorrectChoiceId] = useState(
    source?.correctChoiceId ?? "a",
  );
  const [explanation, setExplanation] = useState(source?.explanation ?? "");
  const [origin, setOrigin] = useState<AdminQuestionOrigin>(
    source?.provenance.kind ?? "original",
  );
  const [author, setAuthor] = useState(source?.provenance.author ?? "");
  const [assistance, setAssistance] = useState(
    source?.provenance.assistance ?? "",
  );
  const [sourcesText, setSourcesText] = useState(
    source?.provenance.sources.join("\n") ?? "",
  );
  const [taxonomyVersionId, setTaxonomyVersionId] = useState<
    Id<"taxonomyVersions"> | ""
  >(initial && sourceTaxonomySealed ? initial.version.taxonomyVersionId : "");
  const [referenceVersionId, setReferenceVersionId] = useState<
    Id<"questionReferenceVersions"> | ""
  >(initial?.version.referenceVersionId ?? "");
  const [errors, setErrors] = useState<AuthoringErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const createDraft = useMutation(api.questions.createDraft);
  const createRevision = useMutation(api.questions.createRevision);
  const router = useRouter();

  // Once the source catalog stops being sealed, stop querying it immediately
  // but keep any different sealed catalog the user picked for recovery.
  const sourceTaxonomyVersionId = initial?.version.taxonomyVersionId;
  const sourceCatalogSelected =
    Boolean(sourceTaxonomyVersionId) &&
    taxonomyVersionId === sourceTaxonomyVersionId;
  const usableTaxonomyVersionId =
    !sourceTaxonomySealed && sourceCatalogSelected ? "" : taxonomyVersionId;
  const taxonomy = useQuery(
    api.questions.listAdminAuthoringOptions,
    usableTaxonomyVersionId
      ? { taxonomyVersionId: usableTaxonomyVersionId }
      : {},
  );
  const activeTaxonomyId =
    usableTaxonomyVersionId || taxonomy?.selected?._id || ("" as const);
  const entries = taxonomy?.entries ?? [];
  const allowedSubjects = moduleSubjectKeys(module);
  const subjects = entries.filter(
    (entry) =>
      entry.kind === "subject" &&
      !entry.archived &&
      Boolean(allowedSubjects?.includes(entry.key)),
  );
  const subtopics = entries.filter(
    (entry) =>
      entry.kind === "subtopic" &&
      !entry.archived &&
      entry.subjectKey === subjectId,
  );
  const concepts = entries.filter(
    (entry) =>
      entry.kind === "concept" &&
      !entry.archived &&
      entry.subjectKey === subjectId &&
      entry.subtopicKey === subtopicId,
  );
  const parsedFamily = Number(family);
  const referenceScope =
    Number.isSafeInteger(parsedFamily) && parsedFamily > 0
      ? { family: parsedFamily, module, language }
      : ("skip" as const);
  const references = useQuery(
    api.questionReferences.listAdminOptions,
    referenceScope,
  );

  function changeModule(next: AdminQuestionModule) {
    const keys = moduleSubjectKeys(next);
    let nextSubject = subjectId;
    if (keys && keys.length === 1) nextSubject = keys[0];
    else if (keys && !keys.includes(subjectId)) nextSubject = "";
    setModule(next);
    setSubjectId(nextSubject);
    setSubtopicId("");
    setConceptId("");
    setReferenceVersionId("");
    if (nextSubject !== "verbal_ability") setLanguage("english");
  }

  function changeSubject(next: string) {
    setSubjectId(next);
    setSubtopicId("");
    setConceptId("");
    if (next !== "verbal_ability") {
      if (language !== "english") setReferenceVersionId("");
      setLanguage("english");
    }
  }

  function changeChoice(index: number, text: string) {
    setChoices((current) =>
      current.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, text } : choice,
      ),
    );
  }

  function addChoice() {
    if (choices.length >= 6) return;
    // Reuse the lowest free letter so removing and re-adding never duplicates
    // a choice ID that the correct answer still points at.
    const id = nextUnusedChoiceId(choices);
    setChoices((current) => [...current, { choiceId: id, text: "" }]);
  }

  function removeChoice(index: number) {
    if (choices.length <= 2) return;
    const removed = choices[index];
    const next = choices.filter((_, choiceIndex) => choiceIndex !== index);
    setChoices(next);
    if (removed.choiceId === correctChoiceId)
      setCorrectChoiceId(next[0]?.choiceId ?? "");
  }

  function focusFirst(nextErrors: AuthoringErrors) {
    const field = firstAuthoringField(nextErrors);
    if (!field) return;
    requestAnimationFrame(() =>
      document.getElementById(authoringFieldIds[field])?.focus(),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const draft: AuthoringDraft = {
      questionId,
      family,
      module,
      subjectId,
      subtopicId,
      conceptId,
      language,
      difficulty,
      stem,
      choices,
      correctChoiceId,
      explanation,
      origin,
      author,
      assistance,
      sourcesText,
      referenceVersionId,
    };
    const nextErrors = validateAuthoringDraft(draft);
    const taxonomyId = taxonomy?.catalogs.find(
      (catalog) => catalog._id === activeTaxonomyId,
    )?._id;
    if (!taxonomyId) nextErrors.taxonomy = "Choose a sealed taxonomy catalog.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirst(nextErrors);
      return;
    }
    if (!taxonomyId) return;
    setPending(true);
    setFormError(null);
    try {
      const content = buildQuestionContent(draft);
      const id =
        mode === "create"
          ? await createDraft({
              questionId: draft.questionId.trim(),
              content,
              taxonomyVersionId: taxonomyId,
              ...(referenceVersionId ? { referenceVersionId } : {}),
            })
          : await createRevision({
              questionId: initial!.question._id,
              expectedCanonicalRevision: initial!.question.revision,
              content,
              taxonomyVersionId: taxonomyId,
              ...(referenceVersionId ? { referenceVersionId } : {}),
            });
      router.push(`/admin/questions/${id}`);
    } catch (error) {
      setFormError(
        adminErrorMessage(
          error,
          "The question version could not be saved. Review the fields and try again.",
        ),
      );
      setPending(false);
    }
  }

  if (taxonomy === undefined)
    return <AdminLoading>Loading authoring options…</AdminLoading>;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className="space-y-8"
    >
      <div>
        <h2 className="font-heading text-2xl font-semibold">
          {mode === "create" ? "New question draft" : "New immutable revision"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {mode === "create"
            ? "This creates a canonical question and its first draft version. Publication requires an independent review."
            : "The original version stays unchanged. This appends the next draft version for the same canonical question and preserves its contributor."}
        </p>
      </div>
      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm"
        >
          {formError}
        </p>
      )}
      {mode === "revise" && !sourceTaxonomySealed && (
        <p
          role="status"
          className="rounded-xl border border-accent bg-accent/10 p-4 text-sm"
        >
          The source version&apos;s taxonomy catalog is no longer sealed. Choose
          a current sealed catalog before saving the revision.
        </p>
      )}
      <fieldset className="space-y-4 rounded-2xl border border-border bg-background p-5">
        <legend className="px-2 font-heading text-lg font-semibold">
          Identity and catalog
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminField
            id="admin-question-id"
            label="Canonical question ID"
            required
            hint="Unique, stable, and limited to 100 characters."
            error={errors.questionId}
          >
            <input
              id="admin-question-id"
              value={questionId}
              disabled={mode === "revise" || pending}
              maxLength={100}
              onChange={(event) => setQuestionId(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.questionId)}
              aria-describedby={adminDescribedBy(
                "admin-question-id",
                "Unique, stable, and limited to 100 characters.",
                errors.questionId,
              )}
              className={adminControlClass}
            />
          </AdminField>
          <AdminField
            id="admin-family"
            label="Family"
            required
            hint="Family cannot change between versions."
            error={errors.family}
          >
            <input
              id="admin-family"
              type="number"
              min={1}
              step={1}
              value={family}
              disabled={mode === "revise" || pending}
              onChange={(event) => {
                setFamily(event.target.value);
                setReferenceVersionId("");
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.family)}
              aria-describedby={adminDescribedBy(
                "admin-family",
                "Family cannot change between versions.",
                errors.family,
              )}
              className={adminControlClass}
            />
          </AdminField>
          <AdminField
            id="admin-taxonomy"
            label="Sealed taxonomy catalog"
            required
            error={errors.taxonomy}
          >
            <select
              id="admin-taxonomy"
              value={activeTaxonomyId}
              disabled={pending || !taxonomy.catalogs.length}
              onChange={(event) =>
                setTaxonomyVersionId(
                  event.target.value as Id<"taxonomyVersions">,
                )
              }
              aria-required="true"
              aria-invalid={Boolean(errors.taxonomy)}
              aria-describedby={adminDescribedBy(
                "admin-taxonomy",
                undefined,
                errors.taxonomy,
              )}
              className={adminControlClass}
            >
              {!taxonomy.catalogs.length && (
                <option value="">No sealed taxonomy catalog</option>
              )}
              {taxonomy.catalogs.map((catalog) => (
                <option key={catalog._id} value={catalog._id}>
                  {catalog.taxonomyId} · revision {catalog.revision}
                </option>
              ))}
            </select>
          </AdminField>
        </div>
        {!taxonomy.catalogs.length && (
          <p role="alert" className="text-sm text-destructive">
            No sealed taxonomy catalog is available. Install and seal a catalog
            before authoring.
          </p>
        )}
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-background p-5">
        <legend className="px-2 font-heading text-lg font-semibold">
          Classification
        </legend>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AdminField
            id="admin-module"
            label="Module"
            required
            error={errors.module}
          >
            <select
              id="admin-module"
              value={module}
              disabled={pending}
              onChange={(event) =>
                changeModule(event.target.value as AdminQuestionModule)
              }
              aria-required="true"
              aria-invalid={Boolean(errors.module)}
              aria-describedby={adminDescribedBy(
                "admin-module",
                undefined,
                errors.module,
              )}
              className={adminControlClass}
            >
              {Object.entries(moduleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField
            id="admin-subject"
            label="Subject"
            required
            error={errors.subjectId}
          >
            <select
              id="admin-subject"
              value={subjectId}
              disabled={pending || Boolean(allowedSubjects?.length === 1)}
              onChange={(event) => changeSubject(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.subjectId)}
              aria-describedby={adminDescribedBy(
                "admin-subject",
                undefined,
                errors.subjectId,
              )}
              className={adminControlClass}
            >
              <option value="">Choose a subject</option>
              {subjects.map((subject) => (
                <option key={subject.key} value={subject.key}>
                  {subject.label}
                </option>
              ))}
              {subjectId &&
                !subjects.some((subject) => subject.key === subjectId) && (
                  <option value={subjectId}>{subjectId}</option>
                )}
            </select>
          </AdminField>
          <AdminField
            id="admin-subtopic"
            label="Subtopic"
            required
            error={errors.subtopicId}
          >
            <select
              id="admin-subtopic"
              value={subtopicId}
              disabled={pending || !subjectId}
              onChange={(event) => {
                setSubtopicId(event.target.value);
                setConceptId("");
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.subtopicId)}
              aria-describedby={adminDescribedBy(
                "admin-subtopic",
                undefined,
                errors.subtopicId,
              )}
              className={adminControlClass}
            >
              <option value="">Choose a subtopic</option>
              {subtopics.map((subtopic) => (
                <option key={subtopic.key} value={subtopic.key}>
                  {subtopic.label}
                </option>
              ))}
              {subtopicId &&
                !subtopics.some((subtopic) => subtopic.key === subtopicId) && (
                  <option value={subtopicId}>{subtopicId}</option>
                )}
            </select>
          </AdminField>
          <AdminField
            id="admin-concept"
            label="Concept"
            required
            error={errors.conceptId}
          >
            <select
              id="admin-concept"
              value={conceptId}
              disabled={pending || !subtopicId}
              onChange={(event) => setConceptId(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.conceptId)}
              aria-describedby={adminDescribedBy(
                "admin-concept",
                undefined,
                errors.conceptId,
              )}
              className={adminControlClass}
            >
              <option value="">Choose a concept</option>
              {concepts.map((concept) => (
                <option key={concept.key} value={concept.key}>
                  {concept.label}
                </option>
              ))}
              {conceptId &&
                !concepts.some((concept) => concept.key === conceptId) && (
                  <option value={conceptId}>{conceptId}</option>
                )}
            </select>
          </AdminField>
          <AdminField
            id="admin-language"
            label="Language"
            required
            hint="Filipino is available only for Verbal Ability."
            error={errors.language}
          >
            <select
              id="admin-language"
              value={language}
              disabled={pending || subjectId !== "verbal_ability"}
              onChange={(event) => {
                setLanguage(event.target.value as AdminQuestionLanguage);
                setReferenceVersionId("");
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.language)}
              aria-describedby={adminDescribedBy(
                "admin-language",
                "Filipino is available only for Verbal Ability.",
                errors.language,
              )}
              className={adminControlClass}
            >
              <option value="english">English</option>
              <option value="filipino">Filipino</option>
            </select>
          </AdminField>
          <AdminField
            id="admin-difficulty"
            label="Difficulty"
            required
            error={errors.difficulty}
          >
            <select
              id="admin-difficulty"
              value={difficulty}
              disabled={pending}
              onChange={(event) =>
                setDifficulty(event.target.value as AdminQuestionDifficulty)
              }
              aria-required="true"
              aria-invalid={Boolean(errors.difficulty)}
              aria-describedby={adminDescribedBy(
                "admin-difficulty",
                undefined,
                errors.difficulty,
              )}
              className={adminControlClass}
            >
              {difficultyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
        </div>
        <p className="text-sm text-muted-foreground">
          Server-enforced level applicability:{" "}
          <strong className="text-foreground">
            {moduleLevels(module)
              .map((level) => levelLabels[level])
              .join(" + ")}
          </strong>
          . This follows from the selected module and is not client-editable.
        </p>
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-background p-5">
        <legend className="px-2 font-heading text-lg font-semibold">
          Question content
        </legend>
        <AdminField id="admin-stem" label="Stem" required error={errors.stem}>
          <textarea
            id="admin-stem"
            rows={5}
            value={stem}
            disabled={pending}
            onChange={(event) => setStem(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.stem)}
            aria-describedby={adminDescribedBy(
              "admin-stem",
              undefined,
              errors.stem,
            )}
            className={adminControlClass}
          />
        </AdminField>
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold">
            Choices (2–6, distinct)
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          </legend>
          {errors.choices && (
            <p role="alert" className="text-sm text-destructive">
              {errors.choices}
            </p>
          )}
          <ol className="space-y-3">
            {choices.map((choice, index) => (
              <li
                key={choice.choiceId}
                className="flex flex-wrap items-start gap-3"
              >
                <label className="flex min-h-11 items-center gap-2 font-bold">
                  <input
                    type="radio"
                    name="correctChoiceId"
                    value={choice.choiceId}
                    checked={correctChoiceId === choice.choiceId}
                    disabled={pending}
                    onChange={() => setCorrectChoiceId(choice.choiceId)}
                    className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  />
                  {choice.choiceId.toUpperCase()}
                  <span className="sr-only">is the correct answer</span>
                </label>
                <input
                  id={`admin-choice-${index}`}
                  aria-label={`Choice ${choice.choiceId.toUpperCase()}`}
                  value={choice.text}
                  disabled={pending}
                  onChange={(event) => changeChoice(index, event.target.value)}
                  className={`${adminControlClass} min-w-0 flex-1`}
                />
                <AdminButton
                  variant="secondary"
                  disabled={pending || choices.length <= 2}
                  onClick={() => removeChoice(index)}
                  aria-label={`Remove choice ${choice.choiceId.toUpperCase()}`}
                >
                  Remove
                </AdminButton>
              </li>
            ))}
          </ol>
          {errors.correctChoiceId && (
            <p role="alert" className="text-sm text-destructive">
              {errors.correctChoiceId}
            </p>
          )}
          <AdminButton
            variant="secondary"
            disabled={pending || choices.length >= 6}
            onClick={addChoice}
          >
            Add choice
          </AdminButton>
        </fieldset>
        <AdminField
          id="admin-explanation"
          label="Explanation"
          required
          error={errors.explanation}
        >
          <textarea
            id="admin-explanation"
            rows={4}
            value={explanation}
            disabled={pending}
            onChange={(event) => setExplanation(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.explanation)}
            aria-describedby={adminDescribedBy(
              "admin-explanation",
              undefined,
              errors.explanation,
            )}
            className={adminControlClass}
          />
        </AdminField>
      </fieldset>
      <fieldset className="space-y-4 rounded-2xl border border-border bg-background p-5">
        <legend className="px-2 font-heading text-lg font-semibold">
          Provenance and optional reference
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminField
            id="admin-origin"
            label="Origin"
            required
            error={errors.origin}
          >
            <select
              id="admin-origin"
              value={origin}
              disabled={pending}
              onChange={(event) =>
                setOrigin(event.target.value as AdminQuestionOrigin)
              }
              aria-required="true"
              aria-invalid={Boolean(errors.origin)}
              aria-describedby={adminDescribedBy(
                "admin-origin",
                undefined,
                errors.origin,
              )}
              className={adminControlClass}
            >
              {originOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField
            id="admin-author"
            label="Content author"
            required
            error={errors.author}
          >
            <input
              id="admin-author"
              value={author}
              disabled={pending}
              onChange={(event) => setAuthor(event.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.author)}
              aria-describedby={adminDescribedBy(
                "admin-author",
                undefined,
                errors.author,
              )}
              className={adminControlClass}
            />
          </AdminField>
        </div>
        <AdminField
          id="admin-assistance"
          label="Authoring assistance"
          required
          hint="Describe tools, reviewers, or other material assistance."
          error={errors.assistance}
        >
          <input
            id="admin-assistance"
            value={assistance}
            disabled={pending}
            onChange={(event) => setAssistance(event.target.value)}
            aria-required="true"
            aria-invalid={Boolean(errors.assistance)}
            aria-describedby={adminDescribedBy(
              "admin-assistance",
              "Describe tools, reviewers, or other material assistance.",
              errors.assistance,
            )}
            className={adminControlClass}
          />
        </AdminField>
        <AdminField
          id="admin-sources"
          label="Sources"
          hint="One source per line. Required for licensed content."
          error={errors.sources}
        >
          <textarea
            id="admin-sources"
            rows={3}
            value={sourcesText}
            disabled={pending}
            onChange={(event) => setSourcesText(event.target.value)}
            aria-invalid={Boolean(errors.sources)}
            aria-describedby={adminDescribedBy(
              "admin-sources",
              "One source per line. Required for licensed content.",
              errors.sources,
            )}
            className={adminControlClass}
          />
        </AdminField>
        <AdminField
          id="admin-reference"
          label="Shared reference version"
          hint="Optional. Only immutable references matching this family, module, and language are listed."
        >
          <select
            id="admin-reference"
            value={referenceVersionId}
            disabled={pending || referenceScope === "skip"}
            onChange={(event) =>
              setReferenceVersionId(
                event.target.value as Id<"questionReferenceVersions">,
              )
            }
            className={adminControlClass}
          >
            <option value="">No shared reference</option>
            {references?.options.map((option) => (
              <option
                key={option.referenceVersionId}
                value={option.referenceVersionId}
              >
                {option.referenceId} · v{option.version} · {option.title}
              </option>
            ))}
          </select>
        </AdminField>
        {referenceScope === "skip" && (
          <p className="text-xs text-muted-foreground">
            Enter a positive family, module, and language to load compatible
            references.
          </p>
        )}
        {references?.overflow && (
          <p role="status" className="text-xs text-muted-foreground">
            Only the first 100 compatible references are shown.
          </p>
        )}
        <ReferencePreview referenceVersionId={referenceVersionId} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-5">
        <AdminButton
          type="submit"
          disabled={pending || !taxonomy.catalogs.length}
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create draft version"
              : "Create revision draft"}
        </AdminButton>
        <Link
          href={
            mode === "revise" && initial
              ? `/admin/questions/${initial.version._id}`
              : "/admin/questions"
          }
          prefetch={false}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Cancel
        </Link>
        {pending && (
          <span role="status" className="text-sm">
            Saving the draft version…
          </span>
        )}
      </div>
    </form>
  );
}
