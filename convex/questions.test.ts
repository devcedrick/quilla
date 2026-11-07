// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import * as questions from "./questions";
import * as questionReferences from "./questionReferences";
import * as questionAssets from "./questionAssets";
import * as questionAssetActions from "./questionAssetActions";
import schema from "./schema";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import type { QuestionContent } from "./lib/questionContent";
import { importQuestionDraft } from "./lib/questionImports";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import { loadPublishedQuestion } from "./lib/questionServing";
const { api, createTest } = defineTestApp({ schema }).defineModules({
  questions,
  questionReferences,
  questionAssets,
  questionAssetActions,
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
const review = {
  decision: "approve" as const,
  reason: "",
  assessment: Array.from({ length: 5 }, () => ({
    passed: true,
    evidence: "Independently verified in test",
  })),
  duplicateDisposition: "none_found" as const,
  duplicateEvidence: "No matching canonical question",
};
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
