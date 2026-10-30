import { v } from "convex/values";

export const examLevel = v.union(
  v.literal("professional"),
  v.literal("subprofessional"),
);
export const preferencesResult = v.object({
  preferredLevel: v.union(examLevel, v.null()),
  targetExamDate: v.union(v.string(), v.null()),
});
export const learningAccessResult = v.object({
  level: examLevel,
  status: v.union(
    v.literal("onboarding_required"),
    v.literal("diagnostic_required"),
  ),
});
