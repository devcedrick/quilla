// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import * as questions from "./questions";
import * as questionReferences from "./questionReferences";
import * as questionAssets from "./questionAssets";
import * as questionAssetActions from "./questionAssetActions";
import * as adminQuestionBankBackfill from "./adminQuestionBankBackfill";
import schema from "./schema";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import type { QuestionContent } from "./lib/questionContent";
import { importQuestionDraft } from "./lib/questionImports";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import { buildQuestionSearchProjection } from "./lib/questionSearchProjection";
import { loadPublishedQuestion } from "./lib/questionServing";
const { api, internal, createTest } = defineTestApp({ schema }).defineModules({
  questions,
  questionReferences,
  questionAssets,
  questionAssetActions,
  adminQuestionBankBackfill,
});
const content: QuestionContent = {
  family: 1,
  module: "shared-core",
  subjectId: "numerical_ability",
  subtopicId: "numerical_reasoning",
  conceptId: "numerical_reasoning",
  levelApplicability: ["professional", "subprofessional"],
  language: "english",
  difficulty: "easy",
  stem: "What is 2 + 3?",
  choices: [
    { choiceId: "a", text: "5" },
    { choiceId: "b", text: "6" },
  ],
  correctChoiceId: "a",
  explanation: "Two plus three is five.",
  provenance: {
    kind: "synthetic",
    author: "fixture",
    assistance: "test only",
    sources: [],
  },
};
// digest([]) with the production canonical serializer: the fingerprint of an
// empty duplicate candidate set.
const emptyCandidateFingerprint =
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const review = {
  decision: "approve" as const,
  reason: "",
  assessment: Array.from({ length: 5 }, () => ({
    passed: true,
    evidence: "Independently verified in test",
  })),
  duplicateDisposition: "none_found" as const,
  duplicateEvidence: "No matching canonical question",
  candidateSetFingerprint: emptyCandidateFingerprint,
};
/** Create isolated actors, a sealed taxonomy and an attributed draft question. */
async function setup() {
  const t = createTest();
  const ids = await t.run(async (ctx) => {
    const result = [];
    for (const [name, role, status] of [
      ["author", "admin", "active"],
      ["reviewer", "admin", "active"],
      ["editor", "admin", "active"],
      ["learner", "user", "active"],
      ["suspended", "admin", "suspended"],
    ] as const)
      result.push(
        await ctx.db.insert("users", {
          tokenIdentifier: "https://test|" + name,
          role,
          status,
        }),
      );
    const taxonomy = await ctx.db.insert("taxonomyVersions", {
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 1,
      createdBy: result[0],
      createdAt: 0,
      updatedAt: 0,
    });
    for (const entry of initialV2Catalog)
      await ctx.db.insert("taxonomyEntries", {
        ...entry,
        taxonomyVersionId: taxonomy,
      });
    return { taxonomy };
  });
  /** Bind a synthetic identity to this isolated test application. */
  const client = (subject: string) =>
    t.withIdentity({ issuer: "https://test", subject });
  const author = client("author");
  const reviewer = client("reviewer");
  const editor = client("editor");
  const versionId = await author.mutation(api.questions.createDraft, {
    questionId: "q1",
    content,
    taxonomyVersionId: ids.taxonomy,
  });
  return {
    t,
    author,
    reviewer,
    editor,
    client,
    versionId,
    taxonomy: ids.taxonomy,
  };
}
describe("question lifecycle", () => {
  it.each(["reject", "needs_revision"] as const)(
    "allows %s despite duplicate overflow while still blocking approval",
    async (decision) => {
      const { t, author, reviewer, versionId, taxonomy } = await setup();
      const original = (await t.run((ctx) =>
        ctx.db.get("questionVersions", versionId),
      ))!;
      await t.run(async (ctx) => {
        for (let i = 0; i < 51; i++) {
          const other = await ctx.db.insert("questions", {
            questionId: `overflow-${i}`,
            contributorId: original.creatorId,
            family: 1,
            latestVersion: 1,
            revision: 1,
            createdAt: 0,
          });
          await ctx.db.insert("questionVersions", {
            questionId: other,
            version: 1,
            content,
            contentHash: original.contentHash,
            contentFingerprint: original.contentFingerprint,
            taxonomyVersionId: taxonomy,
            creatorId: original.creatorId,
            createdAt: 0,
            state: "draft",
            workflowRevision: 1,
            ...buildQuestionSearchProjection(
              content,
              `overflow-${i}`,
              original.contributorId ?? original.creatorId,
            ),
          });
        }
      });
      await author.mutation(api.questions.submitForReview, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 1,
      });
      const context = (await reviewer.query(api.questions.getAdminVersion, {
        questionVersionId: versionId,
      }))!;
      expect(context.duplicates.overflow).toBe(true);
      expect(context.duplicates.ids).toHaveLength(50);
      await expect(
        reviewer.mutation(api.questions.reviewVersion, {
          questionVersionId: versionId,
          expectedWorkflowRevision: 2,
          ...review,
          duplicateDisposition: "adjudicated_distinct",
        }),
      ).rejects.toMatchObject({ data: { code: "DUPLICATE_OVERFLOW" } });
      expect(
        await reviewer.mutation(api.questions.reviewVersion, {
          questionVersionId: versionId,
          expectedWorkflowRevision: 2,
          ...review,
          decision,
          reason: "Duplicate review requires content changes",
          duplicateDisposition: "unresolved",
        }),
      ).toBe(3);
      const stored = await t.run((ctx) =>
        ctx.db
          .query("questionReviews")
          .withIndex("by_questionVersionId", (q) =>
            q.eq("questionVersionId", versionId),
          )
          .unique(),
      );
      expect(stored).toMatchObject({
        decision,
        candidateFingerprint: context.duplicates.fingerprint,
        duplicateDisposition: "unresolved",
      });
      expect(
        (await t.run((ctx) => ctx.db.get("questionVersions", versionId)))
          ?.state,
      ).toBe(decision === "reject" ? "rejected" : "needs_revision");
    },
  );
  it("lets an active material editor submit a correction while retaining a suspended original contributor", async () => {
    const { t, editor, reviewer, versionId, taxonomy } = await setup();
    const original = (await t.run((ctx) =>
      ctx.db.get("questionVersions", versionId),
    ))!;
    const question = (await t.run((ctx) =>
      ctx.db.get("questions", original.questionId),
    ))!;
    await t.run((ctx) =>
      ctx.db.patch("users", question.contributorId, { status: "suspended" }),
    );
    const corrected = await editor.mutation(api.questions.createRevision, {
      questionId: question._id,
      expectedCanonicalRevision: question.revision,
      content: {
        ...content,
        explanation: "Independently recomputed: 2 + 3 = 5.",
      },
      taxonomyVersionId: taxonomy,
    });
    await editor.mutation(api.questions.submitForReview, {
      questionVersionId: corrected,
      expectedWorkflowRevision: 1,
    });
    await expect(
      editor.mutation(api.questions.reviewVersion, {
        questionVersionId: corrected,
        expectedWorkflowRevision: 2,
        ...review,
      }),
    ).rejects.toMatchObject({ data: { code: "SELF_REVIEW" } });
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: corrected,
      expectedWorkflowRevision: 2,
      ...review,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("questions", question._id)))
        ?.contributorId,
    ).toBe(question.contributorId);
    expect(
      (await t.run((ctx) => ctx.db.get("questionVersions", corrected)))?.state,
    ).toBe("approved");
  });
  it("compensates stored blobs if completion fails and rejects corrupt bytes before storage", async () => {
    const app = defineTestApp({ schema });
    const broken = app.defineModules({
      questionAssetActions,
      questionAssets: {
        ...questionAssets,
        completeUpload: app.internalMutation({
          args: {
            assetId: v.id("questionAssets"),
            expectedRevision: v.number(),
            storageId: v.id("_storage"),
          },
          returns: v.null(),
          handler: async () => {
            throw new Error("simulated completion failure");
          },
        }),
      },
    });
    const t = broken.createTest();
    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "https://test|admin",
        role: "admin",
        status: "active",
      }),
    );
    const admin = t.withIdentity({ issuer: "https://test", subject: "admin" });
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    ).buffer;
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const id = await admin.mutation(
      broken.api.questionAssets.beginAssetUpload,
      {
        assetId: "compensate",
        sha256,
        width: 1,
        height: 1,
        mediaType: "image/png",
        provenance: content.provenance,
      },
    );
    await expect(
      admin.action(broken.api.questionAssetActions.uploadAsset, {
        assetId: id,
        expectedRevision: 1,
        bytes: new Uint8Array([1, 2, 3]).buffer,
      }),
    ).rejects.toThrow();
    await expect(
      admin.action(broken.api.questionAssetActions.uploadAsset, {
        assetId: id,
        expectedRevision: 1,
        bytes,
      }),
    ).rejects.toThrow("simulated completion failure");
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").take(10)),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.get("questionAssets", id)),
    ).toMatchObject({ state: "pending", revision: 1 });
  });
  it("preserves imported reference numbers and rolls back creation and audit on failure", async () => {
    const { t, author } = await setup();
    const input = {
      referenceId: "offline-ref",
      version: 3,
      content: {
        family: 1,
        module: "shared-core" as const,
        language: "english" as const,
        title: "Imported",
        provenance: content.provenance,
        blocks: [{ type: "text" as const, text: "Immutable passage" }],
      },
    };
    const first = await author.mutation((ctx) =>
      createReferenceDraft(ctx, input),
    );
    expect(
      await author.mutation((ctx) => createReferenceDraft(ctx, input)),
    ).toBe(first);
    const count = (await t.run((ctx) => ctx.db.query("auditEvents").take(100)))
      .length;
    await expect(
      author.mutation(async (ctx) => {
        await createReferenceDraft(ctx, { ...input, referenceId: "rollback" });
        throw new Error("rollback synthetic domain failure");
      }),
    ).rejects.toThrow("rollback synthetic domain failure");
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("questionReferenceVersions")
          .withIndex("by_referenceId_and_version", (q) =>
            q.eq("referenceId", "rollback"),
          )
          .first(),
      ),
    ).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(100))).length,
    ).toBe(count);
  });
  it("preserves offline versions and makes identical imports a no-op without reassigning authors", async () => {
    const { t, author, reviewer, taxonomy } = await setup();
    const input = {
      questionId: "offline",
      version: 4,
      content,
      taxonomyVersionId: taxonomy,
    };
    const first = await author.mutation((ctx) =>
      importQuestionDraft(ctx, input),
    );
    const snapshot = await t.run((ctx) =>
      ctx.db.get("questions", first.questionId),
    );
    const count = (await t.run((ctx) => ctx.db.query("auditEvents").take(100)))
      .length;
    expect(
      await reviewer.mutation((ctx) => importQuestionDraft(ctx, input)),
    ).toMatchObject({
      created: false,
      questionVersionId: first.questionVersionId,
    });
    expect(
      await t.run((ctx) => ctx.db.get("questions", first.questionId)),
    ).toEqual(snapshot);
    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(100))).length,
    ).toBe(count);
    await expect(
      author.mutation((ctx) =>
        importQuestionDraft(ctx, {
          ...input,
          content: { ...content, explanation: "Changed immutable payload" },
        }),
      ),
    ).rejects.toMatchObject({ data: { code: "CONTENT_CONFLICT" } });
  });
  it("submits, independently approves, publishes and archives with immutable content", async () => {
    const { t, author, reviewer, versionId } = await setup();
    await expect(
      t.query((ctx) => loadPublishedQuestion(ctx, versionId)),
    ).rejects.toThrow();
    await author.mutation(api.questions.submitForReview, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 1,
    });
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 2,
      ...review,
    });
    await author.mutation(api.questions.publishVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 3,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("questionVersions", versionId)))?.state,
    ).toBe("published");
    const served = await t.query((ctx) =>
      loadPublishedQuestion(ctx, versionId),
    );
    expect(served.stem).toBe(content.stem);
    expect(served).not.toHaveProperty("correctChoiceId");
    expect(served).not.toHaveProperty("explanation");
    expect(served).not.toHaveProperty("content");
    await reviewer.mutation(api.questions.archiveVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 4,
    });
    expect(
      await t.run((ctx) => ctx.db.get("questionVersions", versionId)),
    ).toMatchObject({ content, state: "archived", workflowRevision: 5 });
    expect(
      await t.run((ctx) => ctx.db.query("questionReviews").take(10)),
    ).toHaveLength(1);
  });
  it("reports per-version bulk results and enforces batch bounds and authorization", async () => {
    const { t, author, reviewer, editor, client, taxonomy, versionId } =
      await setup();
    const learner = client("learner");
    const create = async (suffix: string) =>
      author.mutation(api.questions.createDraft, {
        questionId: `bulk-${suffix}`,
        content: { ...content, stem: `${content.stem} (${suffix})` },
        taxonomyVersionId: taxonomy,
      });
    const second = await create("second");
    const third = await create("third");
    const all = [versionId, second, third];
    const items = (ids: typeof all, revisions = ids.map(() => 1)) =>
      ids.map((questionVersionId, index) => ({
        questionVersionId,
        expectedWorkflowRevision: revisions[index],
      }));
    await expect(
      t.mutation(api.questions.bulkSubmitForReview, { items: [] }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    await expect(
      learner.mutation(api.questions.bulkSubmitForReview, { items: [] }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(
      learner.mutation(api.questions.bulkSubmitForReview, {
        items: items(all),
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    const editorResult = await editor.mutation(
      api.questions.bulkSubmitForReview,
      { items: items([versionId]) },
    );
    expect(editorResult).toEqual([
      { questionVersionId: versionId, code: "FORBIDDEN" },
    ]);
    const twelve = Array.from({ length: 11 }, () => versionId);
    await expect(
      author.mutation(api.questions.bulkSubmitForReview, {
        items: items(twelve),
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_BATCH" } });
    const submitted = await author.mutation(api.questions.bulkSubmitForReview, {
      items: items(all, [1, 1, 2]),
    });
    expect(submitted).toEqual([
      { questionVersionId: versionId, workflowRevision: 2 },
      { questionVersionId: second, workflowRevision: 2 },
      { questionVersionId: third, code: "STALE_REVISION" },
    ]);
    expect(
      (await t.run((ctx) => ctx.db.get("questionVersions", third)))?.state,
    ).toBe("draft");
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 2,
      ...review,
    });
    const published = await author.mutation(api.questions.bulkPublishVersions, {
      items: items([versionId, second], [3, 2]),
    });
    expect(published).toEqual([
      { questionVersionId: versionId, workflowRevision: 4 },
      { questionVersionId: second, code: "VALIDATION_FAILED" },
    ]);
    const archived = await reviewer.mutation(
      api.questions.bulkArchiveVersions,
      { items: items([versionId, second], [4, 2]) },
    );
    expect(archived).toEqual([
      { questionVersionId: versionId, workflowRevision: 5 },
      { questionVersionId: second, code: "INVALID_TRANSITION" },
    ]);
    expect(
      await t.run((ctx) => ctx.db.get("questionVersions", versionId)),
    ).toMatchObject({ state: "archived", workflowRevision: 5 });
    expect(
      (await t.run((ctx) => ctx.db.get("questionVersions", second)))?.state,
    ).toBe("pending_review");
  });
  it("rejects self-review, stale actions, missing approval and failing quality criteria", async () => {
    const { author, reviewer, versionId } = await setup();
    await expect(
      author.mutation(api.questions.publishVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 1,
      }),
    ).rejects.toThrow();
    await author.mutation(api.questions.submitForReview, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 1,
    });
    await expect(
      author.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 2,
        ...review,
      }),
    ).rejects.toMatchObject({ data: { code: "SELF_REVIEW" } });
    await expect(
      reviewer.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 2,
        ...review,
        assessment: review.assessment.map((a, i) => ({
          ...a,
          passed: i !== 0,
        })),
      }),
    ).rejects.toThrow();
    await expect(
      reviewer.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 1,
        ...review,
      }),
    ).rejects.toMatchObject({ data: { code: "STALE_REVISION" } });
    const result = await Promise.allSettled([
      reviewer.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 2,
        ...review,
      }),
      reviewer.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 2,
        ...review,
        decision: "reject",
        reason: "incorrect",
      }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects approval bound to a stale candidate fingerprint", async () => {
    const { author, reviewer, versionId } = await setup();
    await author.mutation(api.questions.submitForReview, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 1,
    });
    await expect(
      reviewer.mutation(api.questions.reviewVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 2,
        ...review,
        candidateSetFingerprint: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ data: { code: "STALE_REVISION" } });
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 2,
      ...review,
    });
  });
  it("creates immutable corrections and excludes the material editor from review", async () => {
    const { t, author, reviewer, editor, versionId, taxonomy } = await setup();
    const original = await t.run((ctx) =>
      ctx.db.get("questionVersions", versionId),
    );
    const next = await editor.mutation(api.questions.createRevision, {
      questionId: original!.questionId,
      expectedCanonicalRevision: 1,
      content: { ...content, explanation: "Recomputed: 2 + 3 = 5." },
      taxonomyVersionId: taxonomy,
    });
    expect(
      await t.run((ctx) => ctx.db.get("questionVersions", versionId)),
    ).toEqual(original);
    await editor.mutation(api.questions.submitForReview, {
      questionVersionId: next,
      expectedWorkflowRevision: 1,
    });
    for (const client of [editor, author])
      await expect(
        client.mutation(api.questions.reviewVersion, {
          questionVersionId: next,
          expectedWorkflowRevision: 2,
          ...review,
        }),
      ).rejects.toMatchObject({ data: { code: "SELF_REVIEW" } });
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: next,
      expectedWorkflowRevision: 2,
      ...review,
    });
  });
  it("requires fresh duplicate adjudication if a candidate appears after approval", async () => {
    const { author, reviewer, versionId, taxonomy } = await setup();
    await author.mutation(api.questions.submitForReview, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 1,
    });
    await reviewer.mutation(api.questions.reviewVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 2,
      ...review,
    });
    await author.mutation(api.questions.createDraft, {
      questionId: "q2",
      content,
      taxonomyVersionId: taxonomy,
    });
    await expect(
      author.mutation(api.questions.publishVersion, {
        questionVersionId: versionId,
        expectedWorkflowRevision: 3,
      }),
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_RECHECK_REQUIRED" } });
    await reviewer.mutation(api.questions.reviewDuplicateCandidates, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 3,
      candidateSetFingerprint: (await reviewer.query(
        api.questions.getAdminVersion,
        { questionVersionId: versionId },
      ))!.duplicates.fingerprint,
      disposition: "adjudicated_distinct",
      evidence: "Candidate reviewed against this exact version",
    });
    await author.mutation(api.questions.publishVersion, {
      questionVersionId: versionId,
      expectedWorkflowRevision: 4,
    });
  });
  it("blocks unauthenticated, nonadmin and suspended reads/writes", async () => {
    const { t, client, versionId, taxonomy } = await setup();
    const version = await t.run((ctx) =>
      ctx.db.get("questionVersions", versionId),
    );
    if (!version) throw new Error("Missing fixture");
    const assetId = await client("author").mutation(
      api.questionAssets.beginAssetUpload,
      {
        assetId: "guard-fixture",
        sha256: "0".repeat(64),
        width: 1,
        height: 1,
        mediaType: "image/png",
        provenance: content.provenance,
      },
    );
    for (const caller of [
      t,
      client("missing"),
      client("learner"),
      client("suspended"),
    ]) {
      await expect(
        caller.query(api.questions.getAdminVersion, {
          questionVersionId: versionId,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.questions.createDraft, {
          questionId: "forbidden",
          content,
          taxonomyVersionId: taxonomy,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.questions.archiveVersion, {
          questionVersionId: versionId,
          expectedWorkflowRevision: 1,
        }),
      ).rejects.toThrow();
      const wf = { questionVersionId: versionId, expectedWorkflowRevision: 1 };
      for (const operation of [
        () =>
          caller.mutation(api.questions.createRevision, {
            questionId: version.questionId,
            expectedCanonicalRevision: 1,
            content,
            taxonomyVersionId: taxonomy,
          }),
        () => caller.mutation(api.questions.submitForReview, wf),
        () =>
          caller.mutation(api.questions.reviewVersion, { ...wf, ...review }),
        () => caller.mutation(api.questions.publishVersion, wf),
        () =>
          caller.mutation(api.questions.reviewDuplicateCandidates, {
            ...wf,
            candidateSetFingerprint: "0".repeat(64),
            disposition: "none_found",
            evidence: "fixture",
          }),
        () =>
          caller.query(api.questions.listAdminVersions, {
            paginationOpts: { numItems: 1, cursor: null },
          }),
        () =>
          caller.query(api.questions.listAdminQuestionVersions, {
            questionId: version.questionId,
          }),
        () => caller.query(api.questions.listAdminAuthoringOptions, {}),
        () =>
          caller.query(api.questionReferences.listAdminOptions, {
            family: 1,
            module: "shared-core",
            language: "english",
          }),
        () =>
          caller.query(api.questionReferences.getAdminPreview, {
            referenceVersionId: "not-an-id",
          }),
        () =>
          caller.mutation(api.questionReferences.createReferenceVersion, {
            referenceId: "denied",
            expectedLatestVersion: 0,
            content: {
              family: 1,
              module: "shared-core",
              language: "english",
              title: "fixture",
              provenance: content.provenance,
              blocks: [{ type: "text", text: "fixture" }],
            },
          }),
        () =>
          caller.mutation(api.questionAssets.beginAssetUpload, {
            assetId: "denied",
            sha256: "0".repeat(64),
            width: 1,
            height: 1,
            mediaType: "image/png",
            provenance: content.provenance,
          }),
        () =>
          caller.action(api.questionAssetActions.uploadAsset, {
            assetId,
            expectedRevision: 1,
            bytes: new ArrayBuffer(0),
          }),
        () => caller.action(api.questionAssetActions.readAsset, { assetId }),
      ])
        await expect(operation()).rejects.toThrow();
    }
  });
  it("rejects invalid keys, equivalent choices, eligibility and unknown references atomically", async () => {
    const { t, author, taxonomy } = await setup();
    for (const changed of [
      { ...content, correctChoiceId: "missing" },
      {
        ...content,
        choices: [
          { choiceId: "a", text: " five " },
          { choiceId: "b", text: "FIVE" },
        ],
      },
      { ...content, module: "clerical" as const },
      { ...content, explanation: " " },
    ]) {
      await expect(
        author.mutation(api.questions.createDraft, {
          questionId: "bad",
          content: changed,
          taxonomyVersionId: taxonomy,
        }),
      ).rejects.toThrow();
    }
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("questions")
          .withIndex("by_questionId", (q) => q.eq("questionId", "bad"))
          .unique(),
      ),
    ).toBeNull();
  });
  it("creates immutable references and binds only compatible exact versions", async () => {
    const { author, taxonomy } = await setup();
    const refContent = {
      family: 1,
      module: "shared-core" as const,
      language: "english" as const,
      title: "Passage",
      provenance: content.provenance,
      blocks: [{ type: "text" as const, text: "Original passage" }],
    };
    const ref = await author.mutation(
      api.questionReferences.createReferenceVersion,
      { referenceId: "ref", expectedLatestVersion: 0, content: refContent },
    );
    await author.mutation(api.questions.createDraft, {
      questionId: "referenced",
      content,
      taxonomyVersionId: taxonomy,
      referenceVersionId: ref,
    });
    await expect(
      author.mutation(api.questionReferences.createReferenceVersion, {
        referenceId: "ref",
        expectedLatestVersion: 0,
        content: refContent,
      }),
    ).rejects.toThrow();
    await expect(
      author.mutation(api.questions.createDraft, {
        questionId: "wrong-family",
        content: { ...content, family: 2 },
        taxonomyVersionId: taxonomy,
        referenceVersionId: ref,
      }),
    ).rejects.toThrow();
  });
  it("verifies bounded protected image uploads and permits admin byte reads only", async () => {
    const { author, reviewer, client } = await setup();
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    ).buffer;
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const id = await author.mutation(api.questionAssets.beginAssetUpload, {
      assetId: "png",
      sha256,
      width: 1,
      height: 1,
      mediaType: "image/png",
      provenance: content.provenance,
    });
    await expect(
      reviewer.action(api.questionAssetActions.uploadAsset, {
        assetId: id,
        expectedRevision: 1,
        bytes,
      }),
    ).rejects.toThrow();
    await author.action(api.questionAssetActions.uploadAsset, {
      assetId: id,
      expectedRevision: 1,
      bytes,
    });
    expect(
      await reviewer.action(api.questionAssetActions.readAsset, {
        assetId: id,
      }),
    ).toEqual(bytes);
    await expect(
      client("learner").action(api.questionAssetActions.readAsset, {
        assetId: id,
      }),
    ).rejects.toThrow();
    await expect(
      author.action(api.questionAssetActions.uploadAsset, {
        assetId: id,
        expectedRevision: 1,
        bytes,
      }),
    ).rejects.toThrow();
  });
});
describe("admin question bank queries", () => {
  async function bankFixture() {
    const base = await setup();
    const q2 = await base.author.mutation(api.questions.createDraft, {
      questionId: "q2-verbal",
      content: {
        ...content,
        family: 2,
        subjectId: "verbal_ability",
        subtopicId: "vocabulary",
        conceptId: "vocabulary_questions",
        difficulty: "hard",
        stem: "Which word means plentiful?",
        choices: [
          { choiceId: "a", text: "Ample" },
          { choiceId: "b", text: "Narrow" },
        ],
        explanation: "Ample means plentiful in this context.",
        provenance: {
          kind: "licensed",
          author: "fixture two",
          assistance: "test only",
          sources: ["Fixture licence"],
        },
      },
      taxonomyVersionId: base.taxonomy,
    });
    const q3 = await base.reviewer.mutation(api.questions.createDraft, {
      questionId: "q3-reviewer",
      content: {
        ...content,
        family: 3,
        stem: "What is 4 + 4?",
        choices: [
          { choiceId: "a", text: "8" },
          { choiceId: "b", text: "9" },
        ],
        explanation: "Four plus four is eight.",
      },
      taxonomyVersionId: base.taxonomy,
    });
    const users = await base.t.run(async (ctx) => ({
      author: (await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", "https://test|author"),
        )
        .unique())!,
      reviewer: (await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", "https://test|reviewer"),
        )
        .unique())!,
    }));
    return { ...base, q2, q3, users };
  }
  it("combines every required filter and rejects invalid values", async () => {
    const { reviewer, users } = await bankFixture();
    const page = await reviewer.query(api.questions.listAdminVersions, {
      state: "draft",
      family: 1,
      module: "shared-core",
      subjectId: "numerical_ability",
      subtopicId: "numerical_reasoning",
      conceptId: "numerical_reasoning",
      difficulty: "easy",
      language: "english",
      level: "subprofessional",
      origin: "synthetic",
      contributorId: users.author._id,
      questionId: "q1",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.map((version) => version.canonicalQuestionId)).toEqual([
      "q1",
    ]);
    expect(page.isDone).toBe(true);
    const byContributor = await reviewer.query(
      api.questions.listAdminVersions,
      {
        contributorId: users.reviewer._id,
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(
      byContributor.page.map((version) => version.canonicalQuestionId),
    ).toEqual(["q3-reviewer"]);
    const byCanonicalId = await reviewer.query(
      api.questions.listAdminVersions,
      {
        questionId: "q2-verbal",
        paginationOpts: { numItems: 10, cursor: null },
      },
    );
    expect(
      byCanonicalId.page.map((version) => version.canonicalQuestionId),
    ).toEqual(["q2-verbal"]);
    const noMatch = await reviewer.query(api.questions.listAdminVersions, {
      state: "published",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(noMatch.page).toHaveLength(0);
    for (const invalid of [
      { family: 0 },
      { subjectId: "Not A Key" },
      { questionId: "x".repeat(101) },
      { contributorId: "not-an-id" },
    ])
      await expect(
        reviewer.query(api.questions.listAdminVersions, {
          ...invalid,
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toMatchObject({ data: { code: "VALIDATION_FAILED" } });
    await expect(
      reviewer.query(api.questions.listAdminVersions, {
        paginationOpts: { numItems: 0, cursor: null },
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_PAGE_SIZE" } });
  });
  it("searches the admin projection while applying index filters", async () => {
    const { author, reviewer } = await bankFixture();
    const found = await reviewer.query(api.questions.listAdminVersions, {
      search: "plentiful",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(found.page.map((version) => version.canonicalQuestionId)).toEqual([
      "q2-verbal",
    ]);
    const excluded = await author.query(api.questions.listAdminVersions, {
      search: "plentiful",
      origin: "synthetic",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(excluded.page).toHaveLength(0);
    const stem = await reviewer.query(api.questions.listAdminVersions, {
      search: "eight",
      difficulty: "easy",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(stem.page.map((version) => version.canonicalQuestionId)).toEqual([
      "q3-reviewer",
    ]);
  });
  it("still enforces filters beyond the search index's eight slots", async () => {
    const { reviewer, users } = await bankFixture();
    const base = {
      search: "plentiful",
      questionId: "q2-verbal",
      contributorId: users.author._id,
      state: "draft" as const,
      conceptId: "vocabulary_questions",
      subtopicId: "vocabulary",
      subjectId: "verbal_ability",
      module: "shared-core" as const,
      family: 2,
      paginationOpts: { numItems: 10, cursor: null },
    };
    const matching = await reviewer.query(api.questions.listAdminVersions, {
      ...base,
      difficulty: "hard",
      language: "english",
      origin: "licensed",
      level: "professional",
    });
    expect(matching.page.map((version) => version.canonicalQuestionId)).toEqual(
      ["q2-verbal"],
    );
    // Difficulty dropped out of the eight search-index equality slots, so only
    // the post-retrieval predicate can reject this row.
    const rejected = await reviewer.query(api.questions.listAdminVersions, {
      ...base,
      difficulty: "easy",
      language: "english",
      origin: "licensed",
      level: "professional",
    });
    expect(rejected.page).toHaveLength(0);
  });
  it("filters by origin alone through its index", async () => {
    const { reviewer } = await bankFixture();
    const licensed = await reviewer.query(api.questions.listAdminVersions, {
      origin: "licensed",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(licensed.page.map((version) => version.canonicalQuestionId)).toEqual(
      ["q2-verbal"],
    );
    const original = await reviewer.query(api.questions.listAdminVersions, {
      origin: "original",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(original.page).toHaveLength(0);
  });
  it("lists the newest sealed catalogs first and excludes drafts", async () => {
    const { t, reviewer } = await setup();
    const createdBy = (await t.run((ctx) => ctx.db.query("users").first()))!
      ._id;
    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index++)
        await ctx.db.insert("taxonomyVersions", {
          taxonomyId: `sealed-catalog-${index}`,
          state: "sealed",
          revision: 1,
          createdBy,
          createdAt: index + 1,
          updatedAt: index + 1,
        });
      await ctx.db.insert("taxonomyVersions", {
        taxonomyId: "newest-draft-catalog",
        state: "draft",
        revision: 1,
        createdBy,
        createdAt: 1_000,
        updatedAt: 1_000,
      });
    });
    const options = await reviewer.query(
      api.questions.listAdminAuthoringOptions,
      {},
    );
    expect(options.catalogs).toHaveLength(20);
    expect(options.catalogs[0].taxonomyId).toBe("sealed-catalog-24");
    expect(options.catalogs.at(-1)?.taxonomyId).toBe("sealed-catalog-5");
    expect(
      options.catalogs.every((catalog) => catalog.state === "sealed"),
    ).toBe(true);
    expect(options.selected?._id).toBe(options.catalogs[0]._id);
  });
  it("reports reference overflow after reading 101 scoped rows", async () => {
    const { t, reviewer } = await setup();
    const creatorId = (await t.run((ctx) => ctx.db.query("users").first()))!
      ._id;
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index++)
        await ctx.db.insert("questionReferenceVersions", {
          referenceId: `passage-${index}`,
          version: 1,
          content: {
            family: 1,
            module: "shared-core",
            language: "english",
            title: `Passage ${index}`,
            provenance: content.provenance,
            blocks: [{ type: "text", text: `Passage body ${index}` }],
          },
          contentHash: "0".repeat(64),
          creatorId,
          createdAt: index,
          family: 1,
          module: "shared-core",
          language: "english",
        });
    });
    const options = await reviewer.query(
      api.questionReferences.listAdminOptions,
      { family: 1, module: "shared-core", language: "english" },
    );
    expect(options.overflow).toBe(true);
    expect(options.options).toHaveLength(100);
    expect(options.options[0].title).toBe("Passage 100");
    expect(options.options.at(-1)?.title).toBe("Passage 1");
  });
  it("returns immutable version history and authoring options", async () => {
    const { t, author, reviewer, taxonomy, versionId } = await setup();
    const version = (await t.run((ctx) =>
      ctx.db.get("questionVersions", versionId),
    ))!;
    const question = (await t.run((ctx) =>
      ctx.db.get("questions", version.questionId),
    ))!;
    const revisionId = await author.mutation(api.questions.createRevision, {
      questionId: question._id,
      expectedCanonicalRevision: question.revision,
      content: {
        ...content,
        stem: "What is 3 + 3?",
        choices: [
          { choiceId: "a", text: "6" },
          { choiceId: "b", text: "7" },
        ],
        explanation: "Three plus three is six.",
      },
      taxonomyVersionId: taxonomy,
    });
    const history = await reviewer.query(
      api.questions.listAdminQuestionVersions,
      { questionId: question._id },
    );
    expect(history!.versions.map((item) => item._id)).toEqual([
      revisionId,
      version._id,
    ]);
    expect(history!.versions.map((item) => item.version)).toEqual([2, 1]);
    expect(history!.versions[0].contributorId).toBe(question.contributorId);
    expect(history!.overflow).toBe(false);
    const context = await reviewer.query(api.questions.getAdminVersion, {
      questionVersionId: revisionId,
    });
    expect(context!.taxonomy?._id).toBe(taxonomy);
    expect(
      await reviewer.query(api.questions.getAdminVersion, {
        questionVersionId: "not-a-version",
      }),
    ).toBeNull();
    const options = await reviewer.query(
      api.questions.listAdminAuthoringOptions,
      {},
    );
    expect(options.selected?._id).toBe(taxonomy);
    expect(options.catalogs.map((catalog) => catalog._id)).toEqual([taxonomy]);
    expect(options.entries.length).toBeGreaterThan(0);
    const draftTaxonomy = await t.run(async (ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-draft",
        state: "draft",
        revision: 1,
        createdBy: question.contributorId,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(
      reviewer.query(api.questions.listAdminAuthoringOptions, {
        taxonomyVersionId: draftTaxonomy,
      }),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
  });
  it("deduplicates scoped reference options and verifies preview integrity", async () => {
    const { t, author, reviewer } = await setup();
    const reference = {
      family: 1,
      module: "shared-core" as const,
      language: "english" as const,
      title: "Passage v1",
      provenance: content.provenance,
      blocks: [{ type: "text" as const, text: "First passage" }],
    };
    await author.mutation(api.questionReferences.createReferenceVersion, {
      referenceId: "passage",
      expectedLatestVersion: 0,
      content: reference,
    });
    const latest = await author.mutation(
      api.questionReferences.createReferenceVersion,
      {
        referenceId: "passage",
        expectedLatestVersion: 1,
        content: { ...reference, title: "Passage v2" },
      },
    );
    await author.mutation(api.questionReferences.createReferenceVersion, {
      referenceId: "other-module",
      expectedLatestVersion: 0,
      content: {
        ...reference,
        module: "professional-numerical",
        title: "Numerical reference",
      },
    });
    await author.mutation(api.questionReferences.createReferenceVersion, {
      referenceId: "other-family",
      expectedLatestVersion: 0,
      content: { ...reference, family: 2, title: "Other family" },
    });
    const options = await reviewer.query(
      api.questionReferences.listAdminOptions,
      { family: 1, module: "shared-core", language: "english" },
    );
    expect(options.overflow).toBe(false);
    expect(options.options).toHaveLength(1);
    expect(options.options[0]).toMatchObject({
      referenceVersionId: latest,
      referenceId: "passage",
      version: 2,
      title: "Passage v2",
    });
    const preview = await reviewer.query(
      api.questionReferences.getAdminPreview,
      { referenceVersionId: latest },
    );
    expect(preview!.reference.content.title).toBe("Passage v2");
    expect(preview!.assets).toEqual([]);
    expect(
      await reviewer.query(api.questionReferences.getAdminPreview, {
        referenceVersionId: "not-a-reference",
      }),
    ).toBeNull();
    await t.run((ctx) =>
      ctx.db.patch("questionReferenceVersions", latest, {
        contentHash: "0".repeat(64),
      }),
    );
    await expect(
      reviewer.query(api.questionReferences.getAdminPreview, {
        referenceVersionId: latest,
      }),
    ).rejects.toMatchObject({ data: { code: "CONTENT_CONFLICT" } });
  });
});

describe("admin question bank projection backfill", () => {
  it("backfills legacy versions and reference scopes in idempotent batches", async () => {
    const t = createTest();
    const ids = await t.run(async (ctx) => {
      const user = await ctx.db.insert("users", {
        tokenIdentifier: "https://test|backfill",
        role: "admin",
        status: "active",
      });
      const taxonomy = await ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "sealed",
        revision: 1,
        createdBy: user,
        createdAt: 0,
        updatedAt: 0,
      });
      const versions = [];
      for (const questionId of ["legacy-a", "legacy-b"]) {
        const question = await ctx.db.insert("questions", {
          questionId,
          contributorId: user,
          family: 1,
          latestVersion: 1,
          revision: 1,
          createdAt: 0,
        });
        versions.push(
          await ctx.db.insert("questionVersions", {
            questionId: question,
            version: 1,
            content,
            contentHash: "a".repeat(64),
            contentFingerprint: "b".repeat(64),
            taxonomyVersionId: taxonomy,
            creatorId: user,
            createdAt: 0,
            state: "draft",
            workflowRevision: 1,
          }),
        );
      }
      for (const referenceId of ["legacy-reference-a", "legacy-reference-b"])
        await ctx.db.insert("questionReferenceVersions", {
          referenceId,
          version: 1,
          content: {
            family: 1,
            module: "shared-core",
            language: "english",
            title: referenceId,
            provenance: content.provenance,
            blocks: [{ type: "text", text: referenceId }],
          },
          contentHash: "c".repeat(64),
          creatorId: user,
          createdAt: 0,
        });
      return { user, versions };
    });
    const first = await t.mutation(
      internal.adminQuestionBankBackfill.backfillQuestionSearchProjection,
      { cursor: null, batchSize: 1 },
    );
    expect(first).toMatchObject({ scanned: 1, updated: 1, isDone: false });
    const second = await t.mutation(
      internal.adminQuestionBankBackfill.backfillQuestionSearchProjection,
      { cursor: first.continueCursor, batchSize: 1 },
    );
    expect(second).toMatchObject({ scanned: 1, updated: 1, isDone: true });
    const repeated = await t.mutation(
      internal.adminQuestionBankBackfill.backfillQuestionSearchProjection,
      { cursor: null, batchSize: 10 },
    );
    expect(repeated.updated).toBe(0);
    const stored = await t.run((ctx) =>
      ctx.db.get("questionVersions", ids.versions[0]),
    );
    expect(stored).toMatchObject(
      buildQuestionSearchProjection(content, "legacy-a", ids.user),
    );
    const referenceFirst = await t.mutation(
      internal.adminQuestionBankBackfill.backfillReferenceScope,
      { cursor: null, batchSize: 1 },
    );
    expect(referenceFirst).toMatchObject({
      scanned: 1,
      updated: 1,
      isDone: false,
    });
    const referenceSecond = await t.mutation(
      internal.adminQuestionBankBackfill.backfillReferenceScope,
      { cursor: referenceFirst.continueCursor, batchSize: 1 },
    );
    expect(referenceSecond).toMatchObject({
      scanned: 1,
      updated: 1,
      isDone: true,
    });
    const references = await t.run((ctx) =>
      ctx.db.query("questionReferenceVersions").take(10),
    );
    for (const reference of references)
      expect(reference).toMatchObject({
        family: 1,
        module: "shared-core",
        language: "english",
      });
    for (const batchSize of [0, 101])
      await expect(
        t.mutation(
          internal.adminQuestionBankBackfill.backfillQuestionSearchProjection,
          { cursor: null, batchSize },
        ),
      ).rejects.toMatchObject({ data: { code: "VALIDATION_FAILED" } });
  });
});
