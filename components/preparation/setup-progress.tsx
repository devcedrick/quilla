import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { title: "Your exam level", short: "Level", detail: "Choose your path" },
  {
    title: "Your target date",
    short: "Date",
    detail: "Give yourself a little direction",
  },
  {
    title: "A quick review",
    short: "Review",
    detail: "Make sure it feels right",
  },
];

export function SetupProgress({
  step,
  editing = false,
}: {
  step: number;
  editing?: boolean;
}) {
  return (
    <aside className="flex flex-col rounded-t-[1.7rem] bg-primary px-6 py-5 text-primary-foreground lg:rounded-tr-none lg:rounded-l-[1.7rem] lg:p-8">
      <div className="hidden lg:block">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          {editing ? "Room for change" : "A steady start"}
        </p>
        <p className="mt-4 font-heading text-3xl leading-tight">
          {editing ? (
            <>
              Your plans.
              <br />
              Your pace.
            </>
          ) : (
            <>
              One small step
              <br />
              at a time.
            </>
          )}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-primary-foreground/85">
          {editing
            ? "Keep your preparation in step with the plans you have today."
            : "A few choices to make Quilla feel more like your own."}
        </p>
      </div>
      <nav
        aria-label={editing ? "Preference steps" : "Setup progress"}
        className="lg:mt-10"
      >
        <ol className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-7">
          {steps.map((item, index) => (
            <li
              key={item.title}
              aria-current={index === step ? "step" : undefined}
              className="flex min-w-0 flex-col items-center gap-2 lg:flex-row lg:items-start lg:gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                  index <= step
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-primary-foreground/35 text-primary-foreground/80",
                )}
              >
                {index < step ? <Check className="size-4" /> : index + 1}
              </span>
              <span className="min-w-0 text-center lg:text-left">
                <span className="block text-xs font-bold lg:text-sm">
                  <span className="lg:hidden">{item.short}</span>
                  <span className="hidden lg:inline">{item.title}</span>
                </span>
                <span className="mt-1 hidden text-xs leading-relaxed text-primary-foreground/85 lg:block">
                  {item.detail}
                </span>
                <span className="sr-only">
                  {index < step
                    ? " — completed"
                    : index === step
                      ? " — current step"
                      : " — upcoming"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="mt-auto hidden pt-12 lg:block">
        <Image
          src="/brand/kuwi/kuwi-mark.svg"
          width={64}
          height={64}
          alt=""
          aria-hidden="true"
          className="mb-4 size-16 rounded-full bg-accent"
        />
        <p className="text-sm leading-relaxed">Your pace. Your next chapter.</p>
        <p className="mt-2 text-xs leading-relaxed text-primary-foreground/85">
          {editing
            ? "Your current preferences stay as they are until you save."
            : "Nothing is saved until you confirm your setup."}
        </p>
      </div>
    </aside>
  );
}
