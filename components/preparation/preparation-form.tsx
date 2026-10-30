"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import {
  examLevels,
  levelLabels,
  manilaDate,
  targetDateError,
  type ExamLevel,
  type PreparationPreferences,
} from "@/lib/preparation";
import { authRoutes } from "@/lib/auth/routes";
import { SignOut } from "@/components/auth/sign-out";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import { SetupProgress } from "./setup-progress";

const stepCopy = [
  {
    title: "Which exam are you preparing for?",
    description:
      "Choose the path that fits your plans. You can change this later.",
  },
  {
    title: "Have a date in mind?",
    description:
      "An optional target can give your preparation a little direction. No date yet? That’s fine, too.",
  },
  {
    title: "A steady start, made yours.",
    description:
      "Take a moment to check your choices. You can always update them from your account.",
  },
];
const editingStepCopy = [
  {
    title: "A change of direction?",
    description:
      "Choose your preferred exam level. Changes apply to future defaults, not your past progress.",
  },
  {
    title: "Keep your plans up to date.",
    description:
      "Keep your target date, choose a new one, or remove it. A date is always optional.",
  },
  {
    title: "Ready to update your preferences?",
    description:
      "Check your choices before saving. Your current preferences stay in place until you confirm.",
  },
];

const inputClass =
  "w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

export function PreparationForm({
  initialPreferences,
  editing,
  onSavingChange,
}: {
  initialPreferences: PreparationPreferences;
  editing: boolean;
  onSavingChange?: (saving: boolean) => void;
}) {
  // The parent is keyed by verified profile ID; query refreshes preserve dirty input.
  const [original, setOriginal] = useState(initialPreferences);
  const [level, setLevel] = useState<ExamLevel | "">(
    original.preferredLevel ?? "",
  );
  const [date, setDate] = useState(original.targetExamDate ?? "");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<{
    level?: string;
    date?: string;
    acknowledgement?: string;
    form?: string;
  }>({});
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const copy = (editing ? editingStepCopy : stepCopy)[step];
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const movedStep = useRef(false);
  useEffect(() => {
    if (movedStep.current) stepHeading.current?.focus();
  }, [step]);
  function goToStep(next: number) {
    movedStep.current = true;
    setErrors({});
    setStep(next);
  }
  function discardDraft() {
    // Next may retain this route while hidden. Cancel must not revive its draft.
    setOriginal(initialPreferences);
    setLevel(initialPreferences.preferredLevel ?? "");
    setDate(initialPreferences.targetExamDate ?? "");
    setAcknowledged(false);
    setErrors({});
    movedStep.current = false;
    setStep(0);
  }
  const inFlight = useRef(false);
  const levelRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const save = useMutation(api.users.savePreferences);
  const router = useRouter();
  const changingLevel =
    editing && level !== "" && level !== original.preferredLevel;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (step === 0) {
      if (!level) {
        setErrors({ level: "Choose an exam level." });
        levelRef.current?.focus();
      } else goToStep(1);
      return;
    }
    const unchangedDate = date === (original.targetExamDate ?? "");
    const dateError =
      !unchangedDate && date
        ? targetDateError(date, manilaDate(Date.now()))
        : null;
    const nextErrors = {
      ...(!level ? { level: "Choose an exam level." } : {}),
      ...(dateError ? { date: dateError } : {}),
      ...(step === 2 && changingLevel && !acknowledged
        ? { acknowledgement: "Confirm that you understand the level change." }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (!level) {
        setStep(0);
        requestAnimationFrame(() => levelRef.current?.focus());
      } else if (dateError) {
        setStep(1);
        requestAnimationFrame(() => dateRef.current?.focus());
      } else confirmationRef.current?.focus();
      return;
    }
    if (!level) return;
    if (step === 1) {
      goToStep(2);
      return;
    }
    inFlight.current = true;
    setPending(true);
    onSavingChange?.(true);
    try {
      await save({
        preferredLevel: level,
        ...(!unchangedDate ? { targetExamDate: date || null } : {}),
      });
      router.replace(editing ? authRoutes.dashboard : authRoutes.diagnostic);
      router.refresh();
    } catch (error) {
      const invalidDate =
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data !== null &&
        "code" in error.data &&
        error.data.code === "INVALID_TARGET_DATE";
      setErrors(
        invalidDate
          ? {
              date: "Choose a valid date that is today or later in Philippine time.",
            }
          : { form: "Your preferences could not be saved. Please try again." },
      );
      if (invalidDate) {
        setStep(1);
        requestAnimationFrame(() => dateRef.current?.focus());
      } else requestAnimationFrame(() => alertRef.current?.focus());
      inFlight.current = false;
      setPending(false);
      onSavingChange?.(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid lg:grid-cols-[17rem_minmax(0,1fr)]"
      data-preparation-panel=""
      aria-busy={pending}
    >
      <SetupProgress step={step} editing={editing} />
      <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:min-h-[40rem] lg:p-10">
        <header className="mb-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Step {step + 1} of 3
          </p>
          <h2
            ref={stepHeading}
            tabIndex={-1}
            className="max-w-lg rounded-md font-heading text-3xl leading-[1.15] font-semibold tracking-tight outline-none sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {copy.description}
          </p>
        </header>
        <div className="flex-1 space-y-6">
          {step === 0 && (
            <fieldset
              disabled={pending}
              aria-describedby={
                errors.level ? "level-error level-help" : "level-help"
              }
            >
              <legend className="font-bold mb-3">
                Preferred exam level (required)
              </legend>
              <div className="grid gap-3">
                {examLevels.map((value, index) => (
                  <label
                    key={value}
                    className="flex min-h-11 gap-3 rounded-xl border border-border bg-background p-4 cursor-pointer transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-primary/5 has-checked:ring-1 has-checked:ring-primary motion-reduce:transition-none"
                  >
                    <input
                      ref={index === 0 ? levelRef : undefined}
                      type="radio"
                      name="preferredLevel"
                      value={value}
                      checked={level === value}
                      required
                      onChange={() => {
                        setLevel(value);
                        setAcknowledged(false);
                      }}
                      className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    />
                    <span>
                      <span className="block font-bold">
                        {levelLabels[value]}
                      </span>
                      <span className="block text-sm leading-relaxed text-muted-foreground">
                        {value === "professional"
                          ? "Includes Analytical Ability; excludes Clerical Ability."
                          : "Includes Clerical Ability; excludes Analytical Ability."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p id="level-help" className="mt-3 text-sm text-muted-foreground">
                Both levels cover General Information, Verbal Ability in English
                and Filipino, and Numerical Ability.
              </p>
              {errors.level && (
                <p
                  id="level-error"
                  role="alert"
                  className="mt-2 text-sm text-destructive"
                >
                  {errors.level}
                </p>
              )}
            </fieldset>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <CalendarDays
                aria-hidden="true"
                className="mb-5 size-12 rounded-xl bg-accent/35 p-2.5 text-foreground"
              />
              <label htmlFor="target-exam-date" className="font-bold block">
                Target exam date (optional)
              </label>
              <input
                ref={dateRef}
                id="target-exam-date"
                name="targetExamDate"
                type="date"
                className={inputClass}
                disabled={pending}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={
                  errors.date ? "date-help date-error" : "date-help"
                }
              />
              <p id="date-help" className="text-sm text-muted-foreground">
                New dates must be today or later in Philippine time
                (Asia/Manila). Leave blank for no target date. A saved date is
                retained if you change only your level.
              </p>
              {errors.date && (
                <p
                  id="date-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.date}
                </p>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <dl className="divide-y divide-border rounded-2xl border border-border bg-background px-5">
                <div className="py-5">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Exam level
                  </dt>
                  <dd className="mt-2 font-heading text-2xl font-semibold">
                    {level ? levelLabels[level] : "Not selected"}
                  </dd>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => goToStep(0)}
                    className="mt-2 inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                  >
                    Change exam level
                  </button>
                </div>
                <div className="py-5">
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Target exam date
                  </dt>
                  <dd className="mt-2 text-lg font-semibold">
                    {date ? (
                      <time dateTime={date}>{date}</time>
                    ) : (
                      "No target date for now"
                    )}
                  </dd>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => goToStep(1)}
                    className="mt-2 inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                  >
                    Change target date
                  </button>
                </div>
              </dl>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {editing
                  ? "Only your preparation preferences will change. Your progress and history stay as they are."
                  : "Next, you’ll see what a diagnostic will help with. Assessments are not available yet."}
              </p>
            </div>
          )}
          {step === 2 && changingLevel && (
            <div className="rounded-xl border border-primary/30 bg-background p-4 space-y-3">
              <p className="text-sm leading-relaxed">
                Changing your preferred level affects future defaults only. Your
                progress and history are kept. Guidance and readiness for each
                level require that level’s submitted diagnostic.
              </p>
              <label className="flex min-h-11 gap-3 items-start">
                <input
                  ref={confirmationRef}
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  disabled={pending}
                  aria-invalid={Boolean(errors.acknowledgement)}
                  aria-describedby={
                    errors.acknowledgement ? "acknowledgement-error" : undefined
                  }
                  className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                />
                <span>I understand this level change.</span>
              </label>
              {errors.acknowledgement && (
                <p
                  id="acknowledgement-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.acknowledgement}
                </p>
              )}
            </div>
          )}
          {errors.form && (
            <p
              ref={alertRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg border border-destructive p-3 text-sm"
            >
              {errors.form}
            </p>
          )}
          {pending && <p role="status">Saving your preferences…</p>}
        </div>
        <div className="mt-8 space-y-5 border-t border-border/60 pt-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {step > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => goToStep(step - 1)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground transition-colors hover:bg-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60 motion-reduce:transition-none"
            >
              {step === 0
                ? "Continue"
                : step === 1
                  ? editing
                    ? "Review changes"
                    : "Review setup"
                  : editing
                    ? "Save preferences"
                    : "Save and view diagnostic next steps"}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </button>
          </div>
          {step === 1 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDate("");
                goToStep(2);
              }}
              className="mx-auto flex min-h-11 items-center rounded-md text-sm font-semibold text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {editing && original.targetExamDate
                ? "Remove target date"
                : "Skip for now"}
            </button>
          )}
          {editing &&
            (pending ? (
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center text-sm text-muted-foreground"
              >
                Cancel
              </span>
            ) : (
              <Link
                className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                href={authRoutes.dashboard}
                onClick={discardDraft}
                prefetch={false}
              >
                Cancel
              </Link>
            ))}
          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
            <span>
              {editing
                ? "Changes save only when you confirm."
                : "You can take your time."}
            </span>
            <SignOut variant="text" />
          </div>
        </div>
      </div>
    </form>
  );
}
