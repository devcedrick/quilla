import { describe, it, expect, vi } from "vitest";
import {
  prepareImport,
  importBatches,
  parseImportArgs,
  importClient,
  importErrorCode,
  compareImport,
  applyImport,
  readImportStatus,
  importFingerprint,
} from "./import-question-bank.mjs";
import {
  approvedImportTargets,
  importDigest,
  importCanonical,
} from "../lib/question-import-contract.mjs";
import { createHash } from "node:crypto";

/** Create a transport double whose durable checkpoint survives lost client responses. */
function transport({ fail = false, complete = false } = {}) {
  let processed = complete ? 2 : 0,
    staged = complete ? 2 : 0,
    applied = 0;
  const client = {
    query: vi.fn(async (name, args) =>
      name === "preflight"
        ? args.records.map((r) => ({
            ordinal: r.descriptor.ordinal,
            status: "new",
            duplicateCandidates: 0,
          }))
        : {
            run: {
              planChecksum: "plan",
              state:
                processed === 2
                  ? "complete"
                  : staged === 2
                    ? "running"
                    : "preparing",
              staged,
              processed,
            },
            entries: [],
          },
    ),
    mutation: vi.fn(async (name, args) => {
      if (name === "begin") return { runId: "run", generation: 1 };
      if (name === "stage") staged += args.entries.length;
      if (name === "applyBatch") {
        applied++;
        if (fail) throw new Error("UNAUTHENTICATED");
        processed += args.records.length;
      }
      return null;
    }),
    upload: vi.fn(),
  };
  return { client, applied: () => applied };
}
const fixture = {
  manifests: [{ family: 1 }],
  inventoryHash: "inventory",
  planChecksum: "plan",
  report: { planChecksum: "plan" },
  items: [0, 1].map((ordinal) => ({
    descriptor: { ordinal, family: 1 },
    source: { kind: "question", value: {} },
  })),
};

describe("offline import planning", () => {
  it("validates all seven actual families without network or writes and returns stable source checksums", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("NETWORK_FORBIDDEN"));
    try {
      const p = await prepareImport();
      expect(p.report.counts).toEqual({
        questions: 1890,
        references: 265,
        assets: 59,
      });
      expect(p.report.targetComparison).toBe("not-checked");
      expect(network).not.toHaveBeenCalled();
      expect(p.items).toHaveLength(2214);
      expect(p.report.inventory).toHaveLength(2214);
      expect(p.report.manifests.every((m) => m.questions === 270)).toBe(true);
      expect(p.report).not.toHaveProperty("items");
      const output = JSON.stringify(p.report);
      expect(output).not.toContain('"correctChoiceId"');
      expect(output).not.toContain('"explanation"');
      for (const item of p.items.filter((i) => i.source.kind === "asset"))
        expect(createHash("sha256").update(item.bytes).digest("hex")).toBe(
          item.source.value.sha256,
        );
      expect(p.planChecksum).toBe(
        await importDigest({
          manifests: p.manifests,
          inventoryHash: p.inventoryHash,
        }),
      );
    } finally {
      network.mockRestore();
    }
  }, 20000);

  it("normalizes reference blocks before duplicate fingerprinting", async () => {
    const question = {
      stem: "Shared stem",
      choices: [{ text: "A" }, { text: "B" }],
    };
    const normalized = await importFingerprint(question, {
      blocks: [
        { type: "text", text: "  Shared   reference " },
        {
          type: "table",
          caption: " Table ",
          headers: [" A ", "B"],
          rows: [[" C ", "D"]],
        },
      ],
    });
    expect(normalized).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await importFingerprint(question, {
        blocks: [
          { type: "text", text: "shared reference" },
          {
            type: "table",
            caption: "table",
            headers: ["a", "b"],
            rows: [["c", "d"]],
          },
        ],
      }),
    ).toBe(normalized);
    expect(
      await importFingerprint(question, {
        blocks: [{ type: "text", text: "Different reference" }],
      }),
    ).not.toBe(normalized);
  });

  it("bounds batches by count and size and rejects oversized single records", () => {
    expect(
      importBatches(Array.from({ length: 21 }, (_, i) => ({ i }))).map(
        (b) => b.length,
      ),
    ).toEqual([10, 10, 1]);
    expect(
      importBatches([
        { text: "a".repeat(140000) },
        { text: "b".repeat(140000) },
      ]),
    ).toHaveLength(2);
    expect(() => importBatches([{ text: "x".repeat(270000) }])).toThrow(
      "IMPORT_RECORD_TOO_LARGE",
    );
  });

  it("requires explicit write intent, refuses unknown flags and keeps the target registry disabled", () => {
    expect(parseImportArgs([])).toEqual({});
    expect(parseImportArgs(["--json"])).toEqual({ "--json": true });
    for (const args of [
      ["--apply"],
      ["--target", "prod"],
      ["--checkpoint", "x"],
      ["--check-target"],
      ["--force"],
      ["--json", "--json"],
    ])
      expect(() => parseImportArgs(args)).toThrow("IMPORT_INVALID_ARGUMENTS");
    expect(
      parseImportArgs(["--apply", "--target", "dev", "--expect-plan", "hash"])[
        "--apply"
      ],
    ).toBe(true);
    expect(approvedImportTargets).toEqual({});
    expect(() => importClient("prod", "secret")).toThrow(
      "IMPORT_TARGET_NOT_APPROVED",
    );
  });

  it("never prints credential-bearing transport errors", () => {
    expect(importErrorCode(new Error("Bearer super-secret-token"))).toBe(
      "IMPORT_OPERATION_FAILED",
    );
    expect(importErrorCode({ data: { code: "UNAUTHENTICATED" } })).toBe(
      "UNAUTHENTICATED",
    );
    expect(importCanonical({ b: 2, a: [1, 0] })).toBe('{"a":[1,0],"b":2}');
  });
});

describe("import orchestration", () => {
  it("limits parallel preflight to four bounded read requests", async () => {
    let active = 0,
      maximum = 0;
    const { client } = transport();
    client.query.mockImplementation(async (_name, args) => {
      active++;
      maximum = Math.max(maximum, active);
      expect(args.records.length).toBeLessThanOrEqual(10);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return args.records.map((r) => ({
        ordinal: r.descriptor.ordinal,
        status: "new",
        duplicateCandidates: 0,
      }));
    });
    const many = {
      ...fixture,
      items: Array.from({ length: 53 }, (_, ordinal) => ({
        ...fixture.items[0],
        descriptor: { ordinal, family: 1 },
      })),
    };
    expect(await compareImport(many, client, "fixture")).toHaveLength(53);
    expect(maximum).toBe(4);
    expect(client.mutation).not.toHaveBeenCalled();
  });
  it("reads status without writes and refuses a nonadvancing checkpoint", async () => {
    const { client } = transport();
    client.query
      .mockResolvedValueOnce({ run: { staged: 2 }, entries: [{ ordinal: 0 }] })
      .mockResolvedValueOnce({ run: { staged: 2 }, entries: [{ ordinal: 1 }] });
    expect(
      (await readImportStatus(client, "fixture", "run")).entries,
    ).toHaveLength(2);
    expect(client.mutation).not.toHaveBeenCalled();
    client.query.mockResolvedValue({
      run: { staged: 2 },
      entries: [{ ordinal: 0 }],
    });
    await expect(readImportStatus(client, "fixture", "run")).rejects.toThrow(
      "IMPORT_INVALID_CHECKPOINT",
    );
  });
  it("compares every source without mutations", async () => {
    const { client } = transport();
    expect(await compareImport(fixture, client, "fixture")).toHaveLength(2);
    expect(client.mutation).not.toHaveBeenCalled();
    expect(client.upload).not.toHaveBeenCalled();
  });
  it("requires the exact plan before preflight and blocks conflicts or incomplete target responses", async () => {
    const { client } = transport();
    await expect(
      applyImport(fixture, client, {
        target: "fixture",
        expectedPlan: "different",
      }),
    ).rejects.toThrow("IMPORT_PLAN_MISMATCH");
    expect(client.query).not.toHaveBeenCalled();
    client.query.mockResolvedValueOnce([
      { ordinal: 0, status: "conflict" },
      { ordinal: 1, status: "new" },
    ]);
    expect((await compareImport(fixture, client, "fixture"))[0].status).toBe(
      "conflict",
    );
    client.query.mockResolvedValueOnce([]);
    await expect(compareImport(fixture, client, "fixture")).rejects.toThrow(
      "IMPORT_INCOMPLETE_PREFLIGHT",
    );
    expect(client.mutation).not.toHaveBeenCalled();
  });
  it("applies bounded batches then reuses a completed server checkpoint without rewriting content", async () => {
    const first = transport();
    expect(
      (
        await applyImport(fixture, first.client, {
          target: "fixture",
          expectedPlan: "plan",
        })
      ).state,
    ).toBe("complete");
    expect(first.applied()).toBe(1);
    const completed = transport({ complete: true });
    expect(
      (
        await applyImport(fixture, completed.client, {
          target: "fixture",
          expectedPlan: "plan",
          resumeRunId: "run",
        })
      ).state,
    ).toBe("complete");
    expect(completed.applied()).toBe(0);
    expect(
      completed.client.mutation.mock.calls.some(([name]) => name === "stage"),
    ).toBe(false);
  });
  it("stops on a failed batch, releases its lease when authorized and reports recoverable identities", async () => {
    const { client } = transport({ fail: true });
    let caught;
    try {
      await applyImport(fixture, client, {
        target: "fixture",
        expectedPlan: "plan",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught.importRecovery).toEqual({
      target: "fixture",
      runId: "run",
      planChecksum: "plan",
    });
    expect(
      client.mutation.mock.calls.filter(([name]) => name === "applyBatch"),
    ).toHaveLength(1);
    expect(client.mutation).toHaveBeenCalledWith(
      "interrupt",
      expect.objectContaining({ code: "UNAUTHENTICATED" }),
    );
  });
});
