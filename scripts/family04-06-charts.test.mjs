import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const fingerprints = {
  "04": "645f342a3af55f989e9c4955ad8f78426ee6007afa36ce082f6706579e7faf8e",
  "05": "065a2de969307a68c391a8d410989c4d918fc91d923c1b782a7fe54bd9c1946a",
  "06": "ee24c95e38574ee378c2111d36d346ae43ad9e73a0b554e44d605e1f52b2b635",
};
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

describe("Families 04–06 visual data practice", () => {
  for (const family of Object.keys(fingerprints)) {
    it(`family ${family} supplies versioned accessible charts without changing keys`, async () => {
      const root = `content/question-bank/family-${family}`;
      const manifest = await json(`${root}/manifest.json`);
      const source = manifest.sources[0];
      const refs = (
        await Promise.all(
          source.referenceFiles.map((p) => json(`${root}/${p}`)),
        )
      ).flat();
      const assets = (
        await Promise.all(source.assetFiles.map((p) => json(`${root}/${p}`)))
      ).flat();
      const questions = await json(`${root}/content/analytical-data.json`);
      expect(questions).toHaveLength(family === "04" ? 32 : 40);
      const signature = questions.map((q) => [
        q.questionId,
        q.difficulty,
        q.choices,
        q.correctChoiceId,
      ]);
      expect(
        createHash("sha256").update(JSON.stringify(signature)).digest("hex"),
      ).toBe(fingerprints[family]);
      expect(manifest.revision).toBeGreaterThanOrEqual(2);
      const visualRefs = refs.filter((r) =>
        r.blocks.some((b) => b.type === "image"),
      );
      expect(visualRefs.length).toBeGreaterThanOrEqual(5);
      for (const ref of visualRefs) {
        expect(ref.version).toBeGreaterThanOrEqual(2);
        const consumers = questions.filter(
          (q) => q.reference.referenceId === ref.referenceId,
        );
        expect(consumers.length).toBeGreaterThan(0);
        for (const q of consumers) {
          expect(q.reference.referenceVersion).toBe(ref.version);
          expect(q.version).toBeGreaterThanOrEqual(2);
        }
        for (const block of ref.blocks.filter((b) => b.type === "image")) {
          expect(block.alt.trim().length).toBeGreaterThan(15);
          expect(block.description.trim().length).toBeGreaterThan(40);
          const asset = assets.find((a) => a.assetId === block.assetId);
          expect(asset).toBeDefined();
          const bytes = await readFile(`${root}/${asset.path}`);
          expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
          expect(createHash("sha256").update(bytes).digest("hex")).toBe(
            asset.sha256,
          );
        }
      }
    });
  }
});
