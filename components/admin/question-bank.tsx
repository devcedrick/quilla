"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  difficultyOptions,
  languageOptions,
  levelOptions,
  moduleOptions,
  originOptions,
  questionStateOptions,
} from "@/lib/admin/question-options";
import {
  buildQuestionFilterArgs,
  emptyQuestionFilters,
  validateQuestionFilters,
  type QuestionFilterErrors,
  type QuestionFilterValues,
} from "@/lib/admin/question-filters";
import {
  AdminButton,
  AdminField,
  AdminLoading,
  AdminQueryBoundary,
  StateBadge,
  adminControlClass,
  adminDescribedBy,
} from "./admin-ui";

function isoDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

export function QuestionBank() {
  const [draft, setDraft] =
    useState<QuestionFilterValues>(emptyQuestionFilters);
  const [applied, setApplied] =
    useState<QuestionFilterValues>(emptyQuestionFilters);
  const [errors, setErrors] = useState<QuestionFilterErrors>({});
  const taxonomy = useQuery(api.questions.listAdminAuthoringOptions, {});
  const query = useMemo(() => buildQuestionFilterArgs(applied), [applied]);
  const entries = taxonomy?.entries ?? [];
  const subjects = entries.filter(
    (entry) => entry.kind === "subject" && !entry.archived,
  );
  const subtopics = entries.filter(
    (entry) =>
      entry.kind === "subtopic" &&
      !entry.archived &&
      (!draft.subjectId || entry.subjectKey === draft.subjectId),
  );
  const concepts = entries.filter(
    (entry) =>
      entry.kind === "concept" &&
      !entry.archived &&
      (!draft.subjectId || entry.subjectKey === draft.subjectId) &&
      (!draft.subtopicId || entry.subtopicKey === draft.subtopicId),
  );

  function update<K extends keyof QuestionFilterValues>(key: K, value: string) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "subjectId") next.subtopicId = next.conceptId = "";
      if (key === "subtopicId") next.conceptId = "";
      return next;
    });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateQuestionFilters(draft);
    setErrors(nextErrors);
    const firstError = (["search", "family", "questionId"] as const).find(
      (field) => nextErrors[field],
    );
    if (firstError) {
      const ids = {
        search: "admin-filter-search",
        family: "admin-filter-family",
        questionId: "admin-filter-question-id",
      } as const;
      requestAnimationFrame(() =>
        document.getElementById(ids[firstError])?.focus(),
      );
      return;
    }
    setApplied({ ...draft });
  }

  function clear() {
    setDraft({ ...emptyQuestionFilters });
    setApplied({ ...emptyQuestionFilters });
    setErrors({});
  }

  return (
    <div className="grid min-w-0 gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <form
        onSubmit={apply}
        noValidate
        aria-label="Question bank filters"
        className="space-y-5 self-start rounded-2xl border border-border bg-background p-5"
      >
        <div>
          <h2 className="font-heading text-xl font-semibold">Find versions</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Every filter is combined. Search uses the admin-only projection and
            never changes immutable content.
          </p>
        </div>
        <AdminField
          id="admin-filter-search"
          label="Search questions"
          hint="Canonical ID, stem, choices, explanation, or provenance author."
          error={errors.search}
        >
          <input
            id="admin-filter-search"
            type="search"
            value={draft.search}
            onChange={(event) => update("search", event.target.value)}
            aria-invalid={Boolean(errors.search)}
            aria-describedby={adminDescribedBy(
              "admin-filter-search",
              "Canonical ID, stem, choices, explanation, or provenance author.",
              errors.search,
            )}
            className={adminControlClass}
          />
        </AdminField>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <AdminField id="admin-filter-state" label="State">
            <select
              id="admin-filter-state"
              value={draft.state}
              onChange={(event) => update("state", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any state</option>
              {questionStateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField
            id="admin-filter-family"
            label="Family"
            error={errors.family}
          >
            <input
              id="admin-filter-family"
              type="number"
              min={1}
              step={1}
              value={draft.family}
              onChange={(event) => update("family", event.target.value)}
              aria-invalid={Boolean(errors.family)}
              aria-describedby={adminDescribedBy(
                "admin-filter-family",
                undefined,
                errors.family,
              )}
              className={adminControlClass}
            />
          </AdminField>
          <AdminField id="admin-filter-module" label="Module">
            <select
              id="admin-filter-module"
              value={draft.module}
              onChange={(event) => update("module", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any module</option>
              {moduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-subject" label="Subject">
            <select
              id="admin-filter-subject"
              value={draft.subjectId}
              onChange={(event) => update("subjectId", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any subject</option>
              {subjects.map((subject) => (
                <option key={subject.key} value={subject.key}>
                  {subject.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-subtopic" label="Subtopic">
            <select
              id="admin-filter-subtopic"
              value={draft.subtopicId}
              onChange={(event) => update("subtopicId", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any subtopic</option>
              {subtopics.map((subtopic) => (
                <option key={subtopic.key} value={subtopic.key}>
                  {subtopic.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-concept" label="Concept">
            <select
              id="admin-filter-concept"
              value={draft.conceptId}
              onChange={(event) => update("conceptId", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any concept</option>
              {concepts.map((concept) => (
                <option key={concept.key} value={concept.key}>
                  {concept.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-difficulty" label="Difficulty">
            <select
              id="admin-filter-difficulty"
              value={draft.difficulty}
              onChange={(event) => update("difficulty", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any difficulty</option>
              {difficultyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-language" label="Language">
            <select
              id="admin-filter-language"
              value={draft.language}
              onChange={(event) => update("language", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any language</option>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-level" label="Level">
            <select
              id="admin-filter-level"
              value={draft.level}
              onChange={(event) => update("level", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any level</option>
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField id="admin-filter-origin" label="Origin">
            <select
              id="admin-filter-origin"
              value={draft.origin}
              onChange={(event) => update("origin", event.target.value)}
              className={adminControlClass}
            >
              <option value="">Any origin</option>
              {originOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField
            id="admin-filter-contributor"
            label="Contributor user ID"
            hint="Opaque Convex user ID until admin account provisioning ships."
          >
            <input
              id="admin-filter-contributor"
              value={draft.contributorId}
              onChange={(event) => update("contributorId", event.target.value)}
              className={adminControlClass}
            />
          </AdminField>
          <AdminField
            id="admin-filter-question-id"
            label="Canonical question ID"
            error={errors.questionId}
          >
            <input
              id="admin-filter-question-id"
              value={draft.questionId}
              onChange={(event) => update("questionId", event.target.value)}
              maxLength={100}
              aria-invalid={Boolean(errors.questionId)}
              aria-describedby={adminDescribedBy(
                "admin-filter-question-id",
                undefined,
                errors.questionId,
              )}
              className={adminControlClass}
            />
          </AdminField>
        </div>
        <div className="flex flex-wrap gap-3">
          <AdminButton type="submit">Apply filters</AdminButton>
          <AdminButton variant="secondary" onClick={clear}>
            Clear filters
          </AdminButton>
        </div>
      </form>
      <AdminQueryBoundary>
        <QuestionResults query={query} />
      </AdminQueryBoundary>
    </div>
  );
}

function QuestionResults({
  query,
}: {
  query: ReturnType<typeof buildQuestionFilterArgs>;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.questions.listAdminVersions,
    query,
    { initialNumItems: 20 },
  );
  return (
    <section aria-labelledby="question-results-title" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="question-results-title"
          className="font-heading text-2xl font-semibold"
        >
          Versions
        </h2>
        <p className="text-xs text-muted-foreground" role="status">
          {status === "LoadingFirstPage"
            ? "Searching…"
            : `${results.length} loaded`}
        </p>
      </div>
      {status === "LoadingFirstPage" ? (
        <AdminLoading>Loading question versions…</AdminLoading>
      ) : results.length === 0 && status === "Exhausted" ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No question versions match these filters.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No matches on this page yet. Load more to continue searching.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map((version: Doc<"questionVersions">) => (
            <li key={version._id}>
              <article
                data-testid="admin-question-row"
                className="rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold">
                      <Link
                        href={`/admin/questions/${version._id}`}
                        className="rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      >
                        {version.canonicalQuestionId}
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Version {version.version} · family {version.family} ·{" "}
                      {version.subjectId} / {version.subtopicId} /{" "}
                      {version.conceptId}
                    </p>
                  </div>
                  <StateBadge state={version.state} />
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-bold text-muted-foreground">Module</dt>
                    <dd>{version.module}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-muted-foreground">
                      Difficulty
                    </dt>
                    <dd>{version.difficulty}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-muted-foreground">Origin</dt>
                    <dd>{version.origin}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-muted-foreground">Created</dt>
                    <dd>
                      <time
                        dateTime={new Date(version.createdAt).toISOString()}
                      >
                        {isoDate(version.createdAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 flex flex-wrap gap-2 text-xs">
                  {version.professionalEligible && (
                    <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
                      Professional eligible
                    </span>
                  )}
                  {version.subprofessionalEligible && (
                    <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
                      Subprofessional eligible
                    </span>
                  )}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="mt-5">
          <AdminButton
            variant="secondary"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(20)}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more versions"}
          </AdminButton>
        </div>
      )}
    </section>
  );
}
