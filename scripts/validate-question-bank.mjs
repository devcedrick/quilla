import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { policy as legacyPolicy, seedPolicy } from "./question-bank-policy.mjs";

const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const hash = (v) => createHash("sha256").update(v).digest("hex");
const normalized = (v) =>
  v.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
const normalizedContent = (v) =>
  JSON.parse(
    JSON.stringify(v, (_, value) =>
      typeof value === "string" ? normalized(value) : value,
    ),
  );
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const plain = (v) =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  !/<\/?[a-z][^>]*>|javascript:/iu.test(v);
const id = (v) => typeof v === "string" && /^[a-z][a-z0-9_-]*$/.test(v);
const positive = (v) => Number.isSafeInteger(v) && v > 0;
const sha = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const levels = (module) =>
  module === "shared-core"
    ? ["professional", "subprofessional"]
    : [module === "clerical" ? "subprofessional" : "professional"];

export async function validateQuestionBank(manifestPath, mode = "draft") {
  if (!["draft", "release", "seed"].includes(mode))
    throw new Error("Mode must be draft, release or seed");
  const seed = mode === "seed";
  const policy = seed ? seedPolicy : legacyPolicy;
  const root = await realpath(path.dirname(path.resolve(manifestPath)));
  const issues = [];
  const add = (file, recordId, rule, expected, actual, severity = "error") =>
    issues.push({
      file,
      recordId: recordId ?? null,
      rule,
      expected,
      actual: actual ?? null,
      severity,
    });
  const check = (ok, ...args) => {
    if (!ok) add(...args);
  };
  function safePath(relative) {
    if (
      typeof relative !== "string" ||
      !relative ||
      relative.includes("\\") ||
      path.posix.isAbsolute(relative) ||
      /^[a-z]:/i.test(relative) ||
      relative.split("/").some((p) => p === ".." || p === "." || !p)
    )
      throw new Error(`Unsafe corpus path: ${relative}`);
    return relative;
  }
  async function safeFile(relative) {
    safePath(relative);
    const resolved = await realpath(path.join(root, relative));
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel))
      throw new Error(`Path leaves corpus: ${relative}`);
    return readFile(resolved);
  }
  async function json(file) {
    const bytes = await safeFile(file);
    try {
      return JSON.parse(bytes.toString("utf8"));
    } catch {
      add(file, null, "json", "valid JSON", "parse failure");
      return null;
    }
  }
  function shape(v, fields, file, key) {
    if (!object(v)) {
      add(file, key, "record", "object", v);
      return false;
    }
    for (const k of Object.keys(v))
      check(fields.includes(k), file, key, "unknown-field", fields, k);
    return true;
  }
  function provenance(v, file, key) {
    if (!shape(v, ["kind", "author", "sources", "assistance"], file, key))
      return;
    check(
      ["original", "licensed", "synthetic"].includes(v.kind) &&
        plain(v.author) &&
        plain(v.assistance) &&
        Array.isArray(v.sources) &&
        v.sources.every(plain) &&
        (v.kind !== "licensed" || v.sources.length > 0),
      file,
      key,
      "provenance",
      "kind, author, assistance, sources (required for licensed content)",
      v,
    );
  }
  const manifestFile = path.basename(manifestPath);
  const manifest = await json(manifestFile);
  if (
    !shape(
      manifest,
      [
        "formatVersion",
        "corpusId",
        "revision",
        "taxonomyId",
        "blueprintIds",
        "questionFiles",
        "referenceFiles",
        "assetFiles",
        "datasetChecksum",
        "signOff",
        ...(seed ? ["sources", "seedFamilies"] : []),
      ],
      manifestFile,
      null,
    )
  )
    return { mode, issues, checksum: null, summary: {} };
  check(
    manifest.formatVersion === (seed ? 2 : 1) &&
      id(manifest.corpusId) &&
      positive(manifest.revision),
    manifestFile,
    null,
    "manifest-identity",
    `formatVersion=${seed ? 2 : 1}, stable corpusId, positive revision`,
    manifest,
  );
  check(
    manifest.taxonomyId === policy.taxonomy &&
      canonical(manifest.blueprintIds) === canonical(policy.blueprints),
    manifestFile,
    null,
    "policy",
    [policy.taxonomy, ...policy.blueprints],
    [manifest.taxonomyId, manifest.blueprintIds],
  );
  const records = { questions: [], references: [], assets: [] };
  const seenFiles = new Set();
  const fileKinds = [
    ["questionFiles", "questions"],
    ["referenceFiles", "references"],
    ["assetFiles", "assets"],
  ];
  let sources = [manifest];
  if (seed) {
    check(
      Array.isArray(manifest.seedFamilies) &&
        manifest.seedFamilies.length > 0 &&
        new Set(manifest.seedFamilies).size === manifest.seedFamilies.length &&
        manifest.seedFamilies.every(
          (f) => Number.isInteger(f) && f >= 1 && f <= 8,
        ),
      manifestFile,
      null,
      "seed-families",
      "unique family numbers in 1..8",
      manifest.seedFamilies,
    );
    for (const [field] of fileKinds)
      check(
        manifest[field] === undefined,
        manifestFile,
        null,
        "seed-file-lists",
        "file lists inside sources only",
        field,
      );
    check(
      Array.isArray(manifest.sources) && manifest.sources.length > 0,
      manifestFile,
      null,
      "sources",
      "nonempty source inventory",
      manifest.sources,
    );
    sources = (Array.isArray(manifest.sources) ? manifest.sources : []).filter(
      (source) =>
        shape(
          source,
          ["root", ...fileKinds.map(([field]) => field)],
          manifestFile,
          null,
        ),
    );
  }
  const sourceRoots = new Set();
  for (const source of sources) {
    const prefix = seed ? source.root : "";
    if (seed) {
      // Empty root means this manifest's directory, useful for standalone inventories.
      if (prefix !== "") safePath(prefix);
      check(
        !sourceRoots.has(prefix),
        manifestFile,
        null,
        "duplicate-source",
        "unique source roots",
        prefix,
      );
      sourceRoots.add(prefix);
    }
    const sourcePath = (file) => {
      safePath(file);
      return prefix ? `${prefix}/${file}` : file;
    };
    for (const [field, kind] of fileKinds) {
      check(
        Array.isArray(source[field]),
        manifestFile,
        null,
        "file-list",
        "array",
        source[field],
      );
      for (const relative of Array.isArray(source[field])
        ? source[field]
        : []) {
        const file = sourcePath(relative);
        check(
          !seenFiles.has(file),
          manifestFile,
          null,
          "duplicate-file",
          "one declaration per file",
          file,
        );
        seenFiles.add(file);
        const data = await json(file);
        check(Array.isArray(data), file, null, "records", "array", data);
        if (Array.isArray(data))
          records[kind].push(...data.map((value) => ({ file, value, prefix })));
      }
    }
    if (seed) {
      // Catch undeclared JSON in the documented record directories, not just
      // an inventory whose declared subset happens to have the right count.
      async function inventory(relative) {
        const folder = sourcePath(relative);
        let entries;
        try {
          const resolved = await realpath(path.join(root, folder));
          const rel = path.relative(root, resolved);
          if (rel.startsWith("..") || path.isAbsolute(rel))
            throw new Error(`Path leaves corpus: ${folder}`);
          entries = await readdir(resolved, { withFileTypes: true });
        } catch (error) {
          if (error.code === "ENOENT") return;
          throw error;
        }
        for (const entry of entries) {
          const file = `${relative}/${entry.name}`;
          if (entry.isSymbolicLink())
            throw new Error(`Unsafe inventory symlink: ${sourcePath(file)}`);
          if (entry.isDirectory()) await inventory(file);
          else if (entry.name.endsWith(".json"))
            check(
              seenFiles.has(sourcePath(file)),
              manifestFile,
              null,
              "undeclared-file",
              "declare every JSON record file",
              sourcePath(file),
            );
        }
      }
      for (const folder of ["content", "families", "references"])
        await inventory(folder);
    }
  }
  const maps = {};
  const fields = {
    questions: [
      "questionId",
      "version",
      "family",
      "module",
      "subjectId",
      "subtopicId",
      "conceptId",
      "levelApplicability",
      "language",
      "difficulty",
      "stem",
      "choices",
      "correctChoiceId",
      "explanation",
      "provenance",
      "reference",
    ],
    references: [
      "referenceId",
      "version",
      "family",
      "module",
      "language",
      "title",
      "blocks",
      "provenance",
    ],
    assets: [
      "assetId",
      "path",
      "mediaType",
      "sha256",
      "width",
      "height",
      "provenance",
    ],
  };
  for (const kind of Object.keys(records)) {
    maps[kind] = new Map();
    const keyField =
      kind === "questions"
        ? "questionId"
        : kind === "references"
          ? "referenceId"
          : "assetId";
    records[kind] = records[kind].filter(({ value: v, file }) =>
      shape(v, fields[kind], file, v?.[keyField]),
    );
    for (const { value: v, file } of records[kind]) {
      const key = v[keyField];
      check(
        id(key) && !maps[kind].has(key),
        file,
        key,
        "identity",
        "unique stable ID (one version per release)",
        key,
      );
      maps[kind].set(key, v);
      provenance(v.provenance, file, key);
      if (kind !== "assets") {
        check(
          positive(v.version) &&
            Number.isInteger(v.family) &&
            v.family >= 1 &&
            v.family <= 8 &&
            policy.cells.some((c) => c[0] === v.module),
          file,
          key,
          "assignment",
          "positive version, family 1..8, approved module",
          [v.version, v.family, v.module],
        );
        check(
          ["english", "filipino"].includes(v.language),
          file,
          key,
          "language",
          "english or filipino",
          v.language,
        );
      }
    }
  }
  for (const { value: a, file, prefix } of records.assets) {
    check(
      sha(a.sha256) && positive(a.width) && positive(a.height),
      file,
      a.assetId,
      "asset-metadata",
      "SHA-256 and positive dimensions",
      a,
    );
    safePath(a.path);
    const bytes = await safeFile(prefix ? `${prefix}/${a.path}` : a.path);
    let dimensions;
    if (
      bytes.length >= 33 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR"
    )
      dimensions = [
        bytes.readUInt32BE(16),
        bytes.readUInt32BE(20),
        "image/png",
        ".png",
      ];
    if (
      bytes.length >= 30 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP" &&
      bytes.readUInt32LE(4) + 8 === bytes.length
    ) {
      const type = bytes.toString("ascii", 12, 16);
      if (type === "VP8X")
        dimensions = [
          1 + bytes.readUIntLE(24, 3),
          1 + bytes.readUIntLE(27, 3),
          "image/webp",
          ".webp",
        ];
      if (
        type === "VP8 " &&
        bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))
      )
        dimensions = [
          bytes.readUInt16LE(26) & 16383,
          bytes.readUInt16LE(28) & 16383,
          "image/webp",
          ".webp",
        ];
      if (type === "VP8L" && bytes[20] === 47) {
        const bits = bytes.readUInt32LE(21);
        dimensions = [
          (bits & 16383) + 1,
          ((bits >>> 14) & 16383) + 1,
          "image/webp",
          ".webp",
        ];
      }
    }
    check(
      Boolean(dimensions) &&
        dimensions[0] === a.width &&
        dimensions[1] === a.height &&
        dimensions[2] === a.mediaType &&
        path.extname(a.path) === dimensions[3],
      file,
      a.assetId,
      "image",
      "matching PNG/WebP signature, extension and dimensions",
      dimensions,
    );
    check(
      hash(bytes) === a.sha256,
      file,
      a.assetId,
      "asset-checksum",
      a.sha256,
      hash(bytes),
    );
  }
  const usedAssets = new Set();
  for (const { value: r, file } of records.references) {
    check(
      plain(r.title) && Array.isArray(r.blocks) && r.blocks.length > 0,
      file,
      r.referenceId,
      "reference-content",
      "title and nonempty blocks",
      r,
    );
    for (const b of Array.isArray(r.blocks) ? r.blocks : []) {
      if (!object(b)) {
        add(file, r.referenceId, "block", "object", b);
        continue;
      }
      const allowed = {
        text: ["type", "text"],
        table: ["type", "caption", "headers", "rows"],
        image: ["type", "assetId", "caption", "alt", "description"],
      };
      if (!Object.hasOwn(allowed, b.type)) {
        add(file, r.referenceId, "block-type", "text, table or image", b.type);
        continue;
      }
      shape(b, allowed[b.type], file, r.referenceId);
      let valid = false;
      if (b.type === "text") valid = plain(b.text);
      if (b.type === "table")
        valid =
          plain(b.caption) &&
          Array.isArray(b.headers) &&
          b.headers.length > 0 &&
          b.headers.every(plain) &&
          Array.isArray(b.rows) &&
          b.rows.length > 0 &&
          b.rows.every(
            (row) =>
              Array.isArray(row) &&
              row.length === b.headers.length &&
              row.every(plain),
          );
      if (b.type === "image") {
        valid =
          maps.assets.has(b.assetId) &&
          [b.caption, b.alt, b.description].every(plain);
        usedAssets.add(b.assetId);
      }
      check(
        valid,
        file,
        r.referenceId,
        "block-content",
        "valid accessible content with resolved assets",
        b,
      );
    }
  }
  const usedRefs = new Set(),
    duplicates = new Map();
  const dimensions = [
    "family",
    "module",
    "subjectId",
    "conceptId",
    "language",
    "difficulty",
  ];
  const distributions = Object.fromEntries(
    [...dimensions, "level"].map((k) => [k, Object.create(null)]),
  );
  for (const { value: q, file } of records.questions) {
    const key = q.questionId;
    const concepts = Object.hasOwn(policy.concepts, q.subjectId)
      ? policy.concepts[q.subjectId]
      : undefined;
    const pairs =
      concepts && (typeof concepts[0] === "string" ? [concepts] : concepts);
    check(
      pairs?.some((p) => p[0] === q.subtopicId && p[1] === q.conceptId) &&
        policy.cells.some((c) => c[0] === q.module && c[1] === q.subjectId),
      file,
      key,
      "taxonomy",
      "approved subject/subtopic/concept/module relationship",
      [q.module, q.subjectId, q.subtopicId, q.conceptId],
    );
    check(
      canonical(q.levelApplicability) === canonical(levels(q.module)),
      file,
      key,
      "applicability",
      levels(q.module),
      q.levelApplicability,
    );
    check(
      ["easy", "medium", "hard"].includes(q.difficulty) &&
        (q.subjectId === "verbal_ability" || q.language === "english"),
      file,
      key,
      "classification",
      "approved difficulty; English outside Verbal",
      [q.difficulty, q.language],
    );
    check(
      plain(q.stem) && plain(q.explanation),
      file,
      key,
      "question-content",
      "plain nonempty stem and explanation",
      [q.stem, q.explanation],
    );
    const choices = Array.isArray(q.choices) ? q.choices : [];
    check(
      choices.length >= 2 && choices.length <= 6,
      file,
      key,
      "choices",
      "2..6 choices",
      choices.length,
    );
    const choiceIds = new Set(),
      texts = new Set();
    for (const c of choices) {
      if (!shape(c, ["choiceId", "text"], file, key)) continue;
      check(
        id(c.choiceId) &&
          !choiceIds.has(c.choiceId) &&
          plain(c.text) &&
          !texts.has(typeof c.text === "string" ? normalized(c.text) : ""),
        file,
        key,
        "choice",
        "unique ID and unique plain text",
        c,
      );
      choiceIds.add(c.choiceId);
      if (typeof c.text === "string") texts.add(normalized(c.text));
    }
    check(
      choiceIds.has(q.correctChoiceId),
      file,
      key,
      "answer",
      "existing correctChoiceId",
      q.correctChoiceId,
    );
    let ref;
    if (q.reference !== undefined) {
      if (shape(q.reference, ["referenceId", "referenceVersion"], file, key)) {
        ref = maps.references.get(q.reference.referenceId);
        check(
          Boolean(ref) &&
            ref.version === q.reference.referenceVersion &&
            ref.family === q.family &&
            ref.module === q.module &&
            ref.language === q.language,
          file,
          key,
          "reference-link",
          "exact version with same family/module/language",
          q.reference,
        );
        usedRefs.add(q.reference.referenceId);
      }
    }
    if (typeof q.stem === "string") {
      const fingerprint = hash(
        canonical([
          normalized(q.stem),
          [...texts].sort(),
          ref ? normalizedContent(ref.blocks) : null,
        ]),
      );
      if (duplicates.has(fingerprint))
        add(
          file,
          key,
          "duplicate-candidate",
          "editorial adjudication",
          duplicates.get(fingerprint),
          "warning",
        );
      else duplicates.set(fingerprint, key);
    }
    for (const d of dimensions)
      distributions[d][q[d]] = (distributions[d][q[d]] ?? 0) + 1;
    for (const l of levels(q.module))
      distributions.level[l] = (distributions.level[l] ?? 0) + 1;
  }
  for (const [kind, used, field] of [
    ["references", usedRefs, "referenceId"],
    ["assets", usedAssets, "assetId"],
  ])
    for (const { value: v, file } of records[kind])
      check(
        used.has(v[field]),
        file,
        v[field],
        "unreferenced",
        "referenced record",
        v[field],
        mode === "release" || seed ? "error" : "warning",
      );
  const coverage = [];
  if (seed) {
    const families = Array.isArray(manifest.seedFamilies)
      ? manifest.seedFamilies
      : [];
    for (const { value: q, file } of records.questions)
      check(
        families.includes(q.family),
        file,
        q.questionId,
        "seed-assignment",
        "family declared in seedFamilies",
        q.family,
      );
    for (const family of families) {
      const items = records.questions
        .map((r) => r.value)
        .filter((q) => q.family === family);
      const gaps = [];
      const subjects = {};
      for (const [subject, expected] of Object.entries(policy.seedSubjects)) {
        const selected = items.filter((q) => q.subjectId === subject);
        const actual = selected.length;
        subjects[subject] = {
          expected,
          actual,
          difficulties: Object.fromEntries(
            ["easy", "medium", "hard"].map((difficulty) => [
              difficulty,
              selected.filter((q) => q.difficulty === difficulty).length,
            ]),
          ),
        };
        if (actual !== expected)
          gaps.push({ rule: "seed-subject-count", subject, expected, actual });
      }
      if (items.length !== 270)
        gaps.push({
          rule: "seed-question-count",
          expected: 270,
          actual: items.length,
        });
      for (const language of ["english", "filipino"]) {
        const actual = items.filter(
          (q) => q.subjectId === "verbal_ability" && q.language === language,
        ).length;
        if (actual !== 25)
          gaps.push({
            rule: "verbal-language",
            language,
            expected: 25,
            actual,
          });
      }
      coverage.push({
        family,
        questions: items.length,
        subjects,
        complete: gaps.length === 0,
        gaps,
      });
      for (const gap of gaps)
        add(manifestFile, `family-${family}`, gap.rule, gap.expected, gap);
    }
  }
  for (let family = 1; !seed && family <= 8; family++) {
    const items = records.questions
      .map((r) => r.value)
      .filter((q) => q.family === family);
    const gaps = [];
    for (const [module, subject, ...counts] of policy.cells) {
      const selected = items.filter(
        (q) => q.module === module && q.subjectId === subject,
      );
      for (const [i, difficulty] of ["easy", "medium", "hard"].entries()) {
        const actual = selected.filter(
          (q) => q.difficulty === difficulty,
        ).length;
        if (actual !== counts[i])
          gaps.push({
            rule: "difficulty-cell",
            module,
            subject,
            difficulty,
            expected: counts[i],
            actual,
          });
      }
      if (module !== "professional-numerical") {
        const concepts = policy.concepts[subject];
        for (const [, concept] of typeof concepts[0] === "string"
          ? [concepts]
          : concepts)
          if (!selected.some((q) => q.conceptId === concept))
            gaps.push({
              rule: "concept-minimum",
              module,
              concept,
              expected: 1,
              actual: 0,
            });
      }
      if (subject === "verbal_ability")
        for (const language of ["english", "filipino"]) {
          const actual = selected.filter((q) => q.language === language).length;
          if (actual !== 25)
            gaps.push({
              rule: "verbal-language",
              language,
              expected: 25,
              actual,
            });
        }
    }
    coverage.push({
      family,
      questions: items.length,
      complete: gaps.length === 0,
      gaps,
    });
    if (mode === "release")
      for (const gap of gaps)
        add(manifestFile, `family-${family}`, gap.rule, gap.expected, gap);
  }
  const sorted = (kind, field) =>
    records[kind]
      .map((r) => r.value)
      .sort((a, b) => String(a[field]).localeCompare(String(b[field]), "en"));
  const { datasetChecksum, signOff: _signOff, ...identity } = manifest;
  void _signOff;
  const checksum = hash(
    canonical({
      manifest: identity,
      questions: sorted("questions", "questionId"),
      references: sorted("references", "referenceId"),
      assets: sorted("assets", "assetId"),
    }),
  );
  if (datasetChecksum !== undefined)
    check(
      sha(datasetChecksum) && datasetChecksum === checksum,
      manifestFile,
      null,
      "dataset-checksum",
      checksum,
      datasetChecksum,
    );
  issues.sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
  return {
    mode,
    checksum,
    issues,
    summary: {
      questions: records.questions.length,
      references: records.references.length,
      assets: records.assets.length,
      ...(seed
        ? {
            completeSeedFamilies: issues.some((i) => i.severity === "error")
              ? 0
              : coverage.filter((c) => c.complete).length,
            examReadiness: "not-evaluated",
          }
        : {
            professionalExams: coverage.filter((c) => c.complete).length,
            subprofessionalExams: coverage.filter((c) => c.complete).length,
          }),
      distributions,
      coverage,
    },
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    const flags = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--json" && !flags.json) flags.json = true;
      else if (
        ["--manifest", "--mode"].includes(args[i]) &&
        !flags[args[i]] &&
        args[i + 1] &&
        !args[i + 1].startsWith("--")
      )
        flags[args[i]] = args[++i];
      else
        throw new Error(
          "Usage: --manifest <path> --mode draft|release|seed [--json]",
        );
    }
    if (!flags["--manifest"] || !flags["--mode"])
      throw new Error("Require --manifest and --mode");
    const result = await validateQuestionBank(
      flags["--manifest"],
      flags["--mode"],
    );
    console.log(
      flags.json
        ? JSON.stringify(result)
        : `${result.mode}: ${result.summary.questions ?? 0} questions; checksum ${result.checksum}\n${result.issues.map((i) => `${i.severity}: ${i.file} ${i.recordId ?? ""} ${i.rule}: expected ${canonical(i.expected)}, actual ${canonical(i.actual)}`).join("\n")}\n${result.mode === "seed" ? `${result.summary.completeSeedFamilies ?? 0} complete seed families; exam readiness not evaluated` : `${result.summary.coverage?.filter((c) => c.complete).length ?? 0}/8 complete paired families`}`,
    );
    process.exitCode = result.issues.some((i) => i.severity === "error")
      ? 1
      : 0;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
