"use client";

import { useRef, useState, type FormEvent } from "react";
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
  const [original] = useState(initialPreferences);
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
    const unchangedDate = date === (original.targetExamDate ?? "");
    const dateError =
      !unchangedDate && date
        ? targetDateError(date, manilaDate(Date.now()))
        : null;
    const nextErrors = {
      ...(!level ? { level: "Choose an exam level." } : {}),
      ...(dateError ? { date: dateError } : {}),
      ...(changingLevel && !acknowledged
        ? { acknowledgement: "Confirm that you understand the level change." }
        : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (!level) levelRef.current?.focus();
      else if (dateError) dateRef.current?.focus();
      else confirmationRef.current?.focus();
      return;
    }
    if (!level) return;
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
      if (invalidDate) dateRef.current?.focus();
      else requestAnimationFrame(() => alertRef.current?.focus());
      inFlight.current = false;
      setPending(false);
      onSavingChange?.(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-6"
      aria-busy={pending}
    >
      <p className="text-muted-foreground leading-relaxed">
        Choose the CSE level you want to prepare for. Your preference supplies
        future defaults; each attempt will confirm its own level.
      </p>
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
              className="flex min-h-11 gap-3 rounded-xl border border-border bg-background p-4 cursor-pointer has-checked:border-primary has-checked:ring-1 has-checked:ring-primary"
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
                <span className="block font-bold">{levelLabels[value]}</span>
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
          Both levels cover General Information, Verbal Ability in English and
          Filipino, and Numerical Ability.
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
      <div className="space-y-2">
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
          aria-describedby={errors.date ? "date-help date-error" : "date-help"}
        />
        <p id="date-help" className="text-sm text-muted-foreground">
          New dates must be today or later in Philippine time (Asia/Manila).
          Leave blank for no target date. A saved date is retained if you change
          only your level.
        </p>
        {errors.date && (
          <p id="date-error" role="alert" className="text-sm text-destructive">
            {errors.date}
          </p>
        )}
      </div>
      {changingLevel && (
        <div className="rounded-xl border border-primary/30 bg-background p-4 space-y-3">
          <p className="text-sm leading-relaxed">
            Changing your preferred level affects future defaults only. Your
            progress and history are kept. Guidance and readiness for each level
            require that level’s submitted diagnostic.
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
      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-11 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60"
      >
        {editing ? "Save preferences" : "Save and view diagnostic next steps"}
      </button>
      {editing && (
        <Link
          className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
          href={authRoutes.dashboard}
          prefetch={false}
        >
          Cancel
        </Link>
      )}
      <div>
        <SignOut />
      </div>
    </form>
  );
}
