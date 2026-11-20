import type { Doc } from "@/convex/_generated/dataModel";

export type AdminQuestionState = Doc<"questionVersions">["state"];
export type AdminQuestionModule = Doc<"questionVersions">["content"]["module"];
export type AdminQuestionLanguage =
  Doc<"questionVersions">["content"]["language"];
export type AdminQuestionLevel =
  Doc<"questionVersions">["content"]["levelApplicability"][number];
export type AdminQuestionDifficulty =
  Doc<"questionVersions">["content"]["difficulty"];
export type AdminQuestionOrigin =
  Doc<"questionVersions">["content"]["provenance"]["kind"];

type Option<T extends string> = Readonly<{ value: T; label: string }>;

export const questionStateOptions: ReadonlyArray<Option<AdminQuestionState>> = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "needs_revision", label: "Needs revision" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

export const moduleOptions: ReadonlyArray<Option<AdminQuestionModule>> = [
  { value: "shared-core", label: "Shared core" },
  { value: "professional-numerical", label: "Professional numerical" },
  { value: "analytical", label: "Analytical" },
  { value: "clerical", label: "Clerical" },
];

export const languageOptions: ReadonlyArray<Option<AdminQuestionLanguage>> = [
  { value: "english", label: "English" },
  { value: "filipino", label: "Filipino" },
];

export const levelOptions: ReadonlyArray<Option<AdminQuestionLevel>> = [
  { value: "professional", label: "Professional" },
  { value: "subprofessional", label: "Subprofessional" },
];

export const difficultyOptions: ReadonlyArray<Option<AdminQuestionDifficulty>> =
  [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
  ];

export const originOptions: ReadonlyArray<Option<AdminQuestionOrigin>> = [
  { value: "original", label: "Original" },
  { value: "licensed", label: "Licensed" },
  { value: "synthetic", label: "Synthetic" },
];

export const stateLabels = Object.fromEntries(
  questionStateOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionState, string>;
export const moduleLabels = Object.fromEntries(
  moduleOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionModule, string>;
export const languageLabels = Object.fromEntries(
  languageOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionLanguage, string>;
export const levelLabels = Object.fromEntries(
  levelOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionLevel, string>;
export const difficultyLabels = Object.fromEntries(
  difficultyOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionDifficulty, string>;
export const originLabels = Object.fromEntries(
  originOptions.map((option) => [option.value, option.label]),
) as Record<AdminQuestionOrigin, string>;

const sharedCoreSubjects = [
  "general_information",
  "verbal_ability",
  "numerical_ability",
] as const;
const moduleSubjects: Record<AdminQuestionModule, readonly string[] | null> = {
  "shared-core": sharedCoreSubjects,
  "professional-numerical": ["numerical_ability"],
  analytical: ["analytical_ability"],
  clerical: ["clerical_ability"],
};

export function moduleSubjectKeys(module: AdminQuestionModule) {
  return moduleSubjects[module];
}

/** The backend requires exactly these levels for each module. */
export function moduleLevels(
  module: AdminQuestionModule,
): AdminQuestionLevel[] {
  if (module === "shared-core") return ["professional", "subprofessional"];
  if (module === "clerical") return ["subprofessional"];
  return ["professional"];
}

export const rubricCriteria = [
  "Correctness and unique answer",
  "Clear assumptions and plausible distractors",
  "Sufficient explanation",
  "Scope, classification, and reference accessibility",
  "Provenance, originality, and source support",
] as const;
