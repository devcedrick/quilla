// Offline candidate screen; semantic originality and difficulty require review.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const bank = "content/question-bank";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const families = readdirSync(bank).filter((name) =>
  /^family-0[1-4]$/.test(name),
);
const inventories = families.map((name) => {
  const root = join(bank, name);
  const manifest = read(join(root, "manifest.json"));
  const questions = manifest.sources.flatMap((source) =>
    source.questionFiles.flatMap((file) => read(join(root, source.root, file))),
  );
  const references = manifest.sources.flatMap((source) =>
    source.referenceFiles.flatMap((file) =>
      read(join(root, source.root, file)),
    ),
  );
  return { name, revision: manifest.revision, questions, references };
});
const references = new Map(
  inventories
    .flatMap((f) => f.references)
    .map((r) => [`${r.referenceId}@${r.version}`, r]),
);
const supportingText = (q) => {
  if (!q.reference) return "";
  const key = `${q.reference.referenceId}@${q.reference.referenceVersion}`;
  const reference = references.get(key);
  if (!reference) throw new Error(`Unresolved reference ${key}`);
  return JSON.stringify(reference.blocks);
};
const current = inventories.find((f) => f.name === "family-04");
if (!current) throw new Error("Family 04 manifest is required.");
const previous = inventories
  .filter((f) => f !== current)
  .flatMap((f) => f.questions);
const normalized = (text) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const tokens = (text) => new Set(normalized(text).split(" ").filter(Boolean));
const similarity = (a, b) => {
  const intersection = [...a].filter((x) => b.has(x)).length;
  return intersection / (a.size + b.size - intersection || 1);
};
const task = (q) =>
  `${q.stem} ${q.choices
    .map((c) => c.text)
    .sort()
    .join(" ")} ${supportingText(q)}`;
const semanticTask = (q) => `${q.stem} ${supportingText(q)}`;
const near = [];
const comparisons = previous.map((q) => ({
  q,
  tokens: tokens(semanticTask(q)),
}));
for (const q of current.questions) {
  const a = tokens(semanticTask(q));
  for (const other of comparisons) {
    if (other.q.conceptId !== q.conceptId) continue;
    const score = similarity(a, other.tokens);
    if (score >= 0.4)
      near.push({
        id: q.questionId,
        candidate: other.q.questionId,
        score: +score.toFixed(3),
      });
  }
  comparisons.push({ q, tokens: a });
}
const groups = {};
const longest = [];
const disclosed = [];
const exact = [];
const ids = new Map(previous.map((q) => [q.questionId, q]));
const tasks = new Map(previous.map((q) => [normalized(task(q)), q.questionId]));
for (const q of current.questions) {
  const g = (groups[q.subjectId] ??= {
    count: 0,
    difficulty: {},
    language: {},
    concepts: {},
    uniquelyLongestKey: 0,
  });
  g.count++;
  for (const field of ["difficulty", "language"])
    g[field][q[field]] = (g[field][q[field]] ?? 0) + 1;
  g.concepts[q.conceptId] = (g.concepts[q.conceptId] ?? 0) + 1;
  if (ids.has(q.questionId))
    throw new Error(`Duplicate stable ID: ${q.questionId}`);
  ids.set(q.questionId, q);
  const signature = normalized(task(q));
  if (tasks.has(signature)) exact.push([q.questionId, tasks.get(signature)]);
  tasks.set(signature, q.questionId);
  const answer = q.choices.find((c) => c.choiceId === q.correctChoiceId);
  if (!answer) throw new Error(`Missing key: ${q.questionId}`);
  if (
    q.choices.every((c) => c === answer || c.text.length < answer.text.length)
  ) {
    g.uniquelyLongestKey++;
    longest.push(q.questionId);
  }
  if (
    normalized(answer.text).length > 15 &&
    normalized(q.stem).includes(normalized(answer.text))
  )
    disclosed.push(q.questionId);
}
export const auditResult = {
  note: "Candidate screens only: long keys, token overlap and literal disclosures are not proof of a defect; absent candidates do not prove originality.",
  inventories: inventories.map(({ name, revision, questions }) => ({
    name,
    revision,
    count: questions.length,
  })),
  groups,
  exact,
  disclosed,
  longest,
  near: near.sort((a, b) => b.score - a.score),
};
console.log(JSON.stringify(auditResult, null, 2));
