export const examLevels = ["professional", "subprofessional"] as const;
export type ExamLevel = (typeof examLevels)[number];
export type PreparationPreferences = {
  preferredLevel: ExamLevel | null;
  targetExamDate: string | null;
};
export const levelLabels: Record<ExamLevel, string> = {
  professional: "Professional",
  subprofessional: "Subprofessional",
};

/** Calendar date, never a local-midnight timestamp. Use the server clock for writes. */
export function manilaDate(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function targetDateError(value: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date.";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    return "Enter a valid date.";
  if (value < today) return "Choose today or a future date (Philippine time).";
  return null;
}
