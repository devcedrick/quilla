import {
  ArrowDown,
  BookOpenCheck,
  BrainCircuit,
  Check,
  CircleCheck,
  Clock3,
  Compass,
  FileCheck2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import Image from "next/image";

import { LandingAnimation } from "@/components/landing/landing-animation";
import { LandingAccountActions } from "./landing-account-actions";
import { cn } from "@/lib/utils";

const secondaryLink =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-background/75 px-5 py-3 text-sm font-bold text-foreground transition-colors hover:border-foreground/45 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

const journeySteps = [
  {
    number: "01",
    title: "Find your starting point",
    description:
      "A diagnostic is designed to reveal strengths and learning gaps across the coverage for your chosen CSE level.",
    icon: SearchCheck,
  },
  {
    number: "02",
    title: "Focus your study time",
    description:
      "Personalized guidance is designed to turn those results into clear, explainable priorities instead of guesswork.",
    icon: Compass,
  },
  {
    number: "03",
    title: "Practice, then revisit",
    description:
      "Adaptive practice and learner-initiated spaced review are designed to bring weaker concepts back at useful intervals.",
    icon: BrainCircuit,
  },
  {
    number: "04",
    title: "Simulate and learn",
    description:
      "Timed mock exams and repeatable review are designed to connect every result to explanations and the next study step.",
    icon: Clock3,
  },
];

const benefits = [
  {
    title: "Practice with purpose",
    description:
      "Retrieval practice helps turn reading into active recall, with every session tied to a concept you can strengthen.",
    icon: Target,
  },
  {
    title: "Return at the right time",
    description:
      "Spaced review is designed to surface weaker material sooner and stronger material less often.",
    icon: Clock3,
  },
  {
    title: "Understand every mistake",
    description:
      "Useful explanations are designed to show why an answer works—not just mark the choice right or wrong.",
    icon: BookOpenCheck,
  },
];

const sharedCoverage = [
  "General Information",
  "Verbal Ability in English and Filipino",
  "Numerical Ability",
];

export function LandingPage() {
  return (
    <LandingAnimation>
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-foreground px-4 py-3 text-sm font-bold text-background transition-transform focus:translate-y-0 focus:outline-2 focus:outline-offset-4 focus:outline-ring"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="relative z-20 border-b border-foreground/15 bg-background/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8 lg:px-12">
          <a
            className="group inline-flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="#top"
            aria-label="Quilla home"
          >
            <Image
              aria-hidden="true"
              alt=""
              className="size-10 rotate-2 rounded-full border-2 border-foreground shadow-[3px_3px_0_var(--color-foreground)] transition-transform group-hover:-rotate-2"
              height={40}
              src="/brand/kuwi/kuwi-mark.svg"
              width={40}
            />
            <span className="font-heading text-[1.65rem] font-black tracking-[-0.04em]">
              Quilla
            </span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="order-3 hidden w-full flex-wrap items-center gap-x-5 gap-y-1 border-t border-foreground/10 pt-3 text-base font-bold lg:order-none lg:ml-auto lg:flex lg:w-auto lg:border-0 lg:pt-0"
            data-testid="primary-navigation"
          >
            <a
              className="min-h-11 content-center rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href="#how-it-works"
            >
              How it works
            </a>
            <a
              className="min-h-11 content-center rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href="#exam-levels"
            >
              Exam levels
            </a>
            <a
              className="min-h-11 content-center rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              href="#why-quilla"
            >
              Why Quilla
            </a>
          </nav>

          <div
            className="ml-auto flex items-center gap-2 lg:ml-0"
            data-testid="header-auth-actions"
          >
            <LandingAccountActions placement="header" />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          id="top"
          aria-labelledby="hero-title"
          className="paper-grid relative isolate overflow-hidden border-b border-foreground/15"
          data-motion-section="hero"
        >
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12 lg:pb-24 lg:pt-20">
            <div className="max-w-3xl">
              <p
                className="mb-5 inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-foreground/20 bg-card/80 px-2.5 py-2 text-[0.6875rem] font-extrabold uppercase leading-none tracking-[0.04em] sm:gap-2 sm:px-3 sm:text-xs sm:leading-normal sm:tracking-[0.18em]"
                data-motion-target="hero-eyebrow"
                data-testid="hero-eyebrow"
              >
                <Sparkles
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-primary sm:size-4"
                />
                <span className="inline-block" data-motion-text="hero-eyebrow">
                  CSE review, with a clear direction
                </span>
              </p>
              <h1
                id="hero-title"
                className="max-w-4xl font-heading text-5xl font-black leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl"
                data-motion-target="hero-title"
                data-motion-text="hero-title"
              >
                Turn every practice session into your next{" "}
                <span
                  className="relative inline-block text-primary"
                  data-text-accent
                >
                  best study step.
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 -z-10 h-3 w-full -rotate-1 rounded-full bg-accent sm:h-4"
                    data-motion-target="hero-underline"
                  />
                </span>
              </h1>
              <p
                className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9"
                data-motion-target="hero-summary"
                data-motion-text="hero-summary"
              >
                Quilla is designed to help Professional and Subprofessional
                Civil Service Examination candidates find weak concepts,
                practice with purpose, and understand every mistake.
              </p>
              <div
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
                data-motion-target="hero-actions"
              >
                <LandingAccountActions placement="hero" />
                <a className={secondaryLink} href="#how-it-works">
                  See how it works
                  <ArrowDown aria-hidden="true" className="size-4" />
                </a>
              </div>
              <p
                className="mt-5 flex max-w-xl items-start gap-2 text-sm leading-6 text-muted-foreground"
                data-motion-target="hero-note"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                Built for both CSE levels, with the right subject boundaries
                kept clear from the start.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:mx-0 lg:justify-self-end">
              <div
                className="relative z-20 flex min-h-44 items-end justify-center sm:min-h-52 lg:justify-end lg:pr-7"
                data-motion-target="hero-stage"
                data-testid="kuwi-stage"
              >
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 right-1/2 size-52 translate-x-1/2 rounded-full border-[30px] border-accent/45 sm:size-64 sm:border-[36px] lg:right-0 lg:translate-x-0"
                  data-motion-target="hero-orbit"
                >
                  <span
                    className="pointer-events-none absolute -inset-3 rounded-full"
                    data-motion-loop="hero-orbit"
                  >
                    <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 rounded-full border-2 border-foreground bg-accent shadow-[2px_2px_0_var(--color-ink-shadow)] sm:size-4" />
                  </span>
                </div>
                <div className="relative z-10" data-motion-loop="hero-kuwi">
                  <Image
                    aria-hidden="true"
                    alt=""
                    className="h-auto w-44 translate-y-6 sm:w-56 sm:translate-y-8 lg:w-64"
                    data-testid="kuwi-hero"
                    height={1150}
                    priority
                    src="/brand/kuwi/kuwi-hero.svg"
                    width={1368}
                  />
                </div>
              </div>
              <div className="relative z-10" data-motion-target="hero-card">
                <div
                  aria-hidden="true"
                  className="absolute -left-5 -top-5 size-24 rotate-6 rounded-2xl bg-accent/75"
                  data-motion-loop="hero-accent"
                />
                <article
                  className="relative rotate-[-1deg] rounded-[2rem] border-2 border-foreground bg-card p-5 shadow-[10px_12px_0_var(--color-ink-shadow)] sm:p-7"
                  data-testid="study-loop-card"
                >
                  <div className="flex items-start justify-between gap-4 border-b-2 border-foreground/15 pb-5">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                        Your study loop
                      </p>
                      <h2
                        className="mt-1 font-heading text-3xl font-black tracking-[-0.035em]"
                        data-motion-text="hero-card-title"
                      >
                        Learn what comes next.
                      </h2>
                    </div>
                    <span className="rounded-full border border-foreground/20 bg-accent px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                      Focused
                    </span>
                  </div>

                  <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ["01", "Diagnose", "See the starting point"],
                      ["02", "Focus", "Choose what matters"],
                      ["03", "Practice", "Strengthen the concept"],
                      ["04", "Review", "Learn from the result"],
                    ].map(([number, itemTitle, description], index) => (
                      <li
                        key={itemTitle}
                        className={cn(
                          "rounded-2xl border border-foreground/15 p-4",
                          index === 1
                            ? "bg-primary text-primary-foreground"
                            : "bg-background",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-heading text-2xl font-black">
                            {number}
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-3 rounded-full border-2",
                              index === 1
                                ? "border-primary-foreground bg-accent"
                                : "border-foreground/40",
                            )}
                          />
                        </div>
                        <p className="mt-5 font-extrabold">{itemTitle}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm leading-6",
                            index === 1
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground",
                          )}
                        >
                          {description}
                        </p>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-foreground/30 bg-accent/25 p-4">
                    <Target
                      aria-hidden="true"
                      className="size-5 text-primary"
                    />
                    <p className="text-sm font-bold">
                      One result should always point to a useful next action.
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="journey-title"
          className="scroll-mt-6 border-b border-foreground/15 bg-card py-20 sm:py-28"
          data-motion-section="journey"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div
              className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
              data-motion-target="journey-intro"
            >
              <div>
                <p className="section-kicker">How Quilla works</p>
                <h2
                  id="journey-title"
                  data-motion-text="section-title"
                  className="mt-3 max-w-2xl font-heading text-4xl font-black leading-tight tracking-[-0.045em] text-balance sm:text-5xl"
                >
                  From first diagnostic to focused review.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
                The Quilla journey is designed as a learning loop—not a pile of
                disconnected quizzes. Each stage makes the next decision easier
                to understand.
              </p>
            </div>

            <ol className="mt-14 grid gap-5 md:grid-cols-2">
              {journeySteps.map((step) => {
                const Icon = step.icon;

                return (
                  <li
                    key={step.number}
                    className="group relative min-h-64 overflow-hidden rounded-[1.75rem] border border-foreground/15 bg-background p-6 sm:p-8"
                    data-motion-target="journey-item"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-8 font-heading text-[8rem] font-black leading-none text-foreground/[0.045] transition-transform group-hover:-translate-x-2"
                    >
                      {step.number}
                    </span>
                    <div className="relative flex h-full flex-col">
                      <div className="grid size-12 place-items-center rounded-2xl border border-foreground/15 bg-accent/55">
                        <Icon
                          aria-hidden="true"
                          className="size-6 text-primary"
                        />
                      </div>
                      <p className="mt-auto pt-10 text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                        Step {step.number}
                      </p>
                      <h3 className="mt-2 font-heading text-2xl font-black tracking-[-0.03em]">
                        {step.title}
                      </h3>
                      <p className="mt-3 max-w-lg leading-7 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section
          id="exam-levels"
          aria-labelledby="levels-title"
          className="scroll-mt-6 border-b border-foreground/15 bg-secondary py-20 sm:py-28"
          data-motion-section="levels"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="max-w-3xl" data-motion-target="levels-intro">
              <p className="section-kicker">The right exam coverage</p>
              <h2
                id="levels-title"
                data-motion-text="section-title"
                className="mt-3 font-heading text-4xl font-black leading-tight tracking-[-0.045em] text-balance sm:text-5xl"
              >
                One goal. Two distinct CSE levels.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Both levels share a strong core, while Quilla keeps their
                level-specific abilities separate and explicit.
              </p>
            </div>

            <div
              className="mt-12 rounded-[1.75rem] border border-foreground/15 bg-card p-6 sm:p-8"
              data-motion-target="levels-shared"
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                Shared coverage
              </p>
              <ul className="mt-5 grid gap-4 md:grid-cols-3">
                {sharedCoverage.map((subject) => (
                  <li
                    key={subject}
                    className="flex items-start gap-3 font-bold"
                  >
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-primary"
                    />
                    {subject}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <article
                className="rounded-[1.75rem] border-2 border-primary bg-primary p-7 text-primary-foreground sm:p-9"
                data-motion-target="levels-card"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary-foreground/75">
                    CSE level
                  </p>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-accent-foreground">
                    Professional
                  </span>
                </div>
                <h3 className="mt-8 font-heading text-3xl font-black tracking-[-0.035em]">
                  Analytical Ability
                </h3>
                <p className="mt-3 max-w-xl leading-7 text-primary-foreground/80">
                  Professional preparation adds Analytical Ability to the shared
                  examination coverage.
                </p>
                <p className="mt-8 flex items-center gap-2 border-t border-primary-foreground/20 pt-5 text-sm font-bold">
                  <CircleCheck aria-hidden="true" className="size-5" />
                  Clerical Ability is not included.
                </p>
              </article>

              <article
                className="rounded-[1.75rem] border-2 border-foreground bg-card p-7 shadow-[7px_8px_0_var(--color-ink-shadow)] sm:p-9"
                data-motion-target="levels-card"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                    CSE level
                  </p>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                    Subprofessional
                  </span>
                </div>
                <h3 className="mt-8 font-heading text-3xl font-black tracking-[-0.035em]">
                  Clerical Ability
                </h3>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">
                  Subprofessional preparation adds Clerical Ability to the
                  shared examination coverage.
                </p>
                <p className="mt-8 flex items-center gap-2 border-t border-foreground/15 pt-5 text-sm font-bold">
                  <CircleCheck
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  Analytical Ability is not included.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="why-quilla"
          aria-labelledby="benefits-title"
          className="scroll-mt-6 border-b border-foreground/15 bg-background py-20 sm:py-28"
          data-motion-section="benefits"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="max-w-3xl" data-motion-target="benefits-intro">
              <p className="section-kicker">Built for learning</p>
              <h2
                id="benefits-title"
                data-motion-text="section-title"
                className="mt-3 font-heading text-4xl font-black leading-tight tracking-[-0.045em] text-balance sm:text-5xl"
              >
                Review should tell you what to do next.
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Quilla is designed around proven learning practices that make
                progress understandable, actionable, and personal.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;

                return (
                  <article
                    key={benefit.title}
                    className={cn(
                      "rounded-[1.75rem] border border-foreground/15 p-6 sm:p-8",
                      index === 1 ? "bg-accent/55" : "bg-card",
                    )}
                    data-motion-target="benefits-card"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                        <Icon aria-hidden="true" className="size-6" />
                      </div>
                      <span className="font-heading text-4xl font-black text-foreground/10">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-8 font-heading text-2xl font-black tracking-[-0.03em]">
                      {benefit.title}
                    </h3>
                    <p className="mt-3 leading-7 text-muted-foreground">
                      {benefit.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="content-integrity"
          aria-labelledby="trust-title"
          className="scroll-mt-6 bg-foreground py-20 text-background sm:py-28"
          data-motion-section="trust"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:px-12">
            <div
              className="lg:sticky lg:top-8"
              data-motion-target="trust-intro"
            >
              <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-accent">
                <ShieldCheck aria-hidden="true" className="size-5" />
                Trust and content integrity
              </p>
              <h2
                id="trust-title"
                data-motion-text="section-title"
                className="mt-4 max-w-2xl font-heading text-4xl font-black leading-tight tracking-[-0.045em] text-balance sm:text-5xl"
              >
                Preparation you can use with confidence.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-background/70">
                Better preparation depends on honest expectations, useful
                explanations, and original practice material.
              </p>
            </div>

            <div className="grid gap-4">
              <article
                className="rounded-[1.75rem] border border-background/20 bg-background/5 p-6 sm:p-8"
                data-motion-target="trust-item"
              >
                <FileCheck2 aria-hidden="true" className="size-7 text-accent" />
                <h3 className="mt-5 font-heading text-2xl font-black">
                  Original practice, not shortcuts
                </h3>
                <p className="mt-3 leading-7 text-background/70">
                  Quilla does not host leaked or actual Civil Service
                  Examination questions. Practice content is designed to build
                  understanding without compromising exam integrity.
                </p>
              </article>
              <article
                className="rounded-[1.75rem] border border-background/20 bg-background/5 p-6 sm:p-8"
                data-motion-target="trust-item"
              >
                <BookOpenCheck
                  aria-hidden="true"
                  className="size-7 text-accent"
                />
                <h3 className="mt-5 font-heading text-2xl font-black">
                  Explanations over answer keys
                </h3>
                <p className="mt-3 leading-7 text-background/70">
                  Published practice is intended to include explanations and
                  quality checks so an incorrect answer can become a useful
                  learning moment.
                </p>
              </article>
              <article
                className="rounded-[1.75rem] border border-accent/55 bg-accent p-6 text-accent-foreground sm:p-8"
                data-motion-target="trust-item"
              >
                <ShieldCheck aria-hidden="true" className="size-7" />
                <h3 className="mt-5 font-heading text-2xl font-black">
                  Independent by design
                </h3>
                <p className="mt-3 font-semibold leading-7">
                  Quilla is an independent learning platform. It is not
                  affiliated with, endorsed by, or connected to the Philippine
                  Civil Service Commission.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="final-cta-title"
          className="paper-grid border-b border-foreground/15 py-20 sm:py-28"
          data-motion-section="cta"
        >
          <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
            <div
              className="rounded-[2rem] border-2 border-foreground bg-card px-6 py-12 shadow-[9px_10px_0_var(--color-ink-shadow)] sm:px-12 sm:py-16"
              data-motion-target="cta-card"
            >
              <p className="section-kicker">Make practice count</p>
              <h2
                id="final-cta-title"
                data-motion-text="section-title"
                className="mx-auto mt-3 max-w-3xl font-heading text-4xl font-black leading-tight tracking-[-0.045em] text-balance sm:text-5xl"
              >
                Start with clarity. Keep building from there.
              </h2>
              <LandingAccountActions placement="closing" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between lg:px-12">
          <div>
            <a
              className="inline-flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              href="#top"
              aria-label="Back to the top of Quilla home"
            >
              <Image
                aria-hidden="true"
                alt=""
                className="size-9 rounded-full border-2 border-foreground"
                height={36}
                src="/brand/kuwi/kuwi-mark.svg"
                width={36}
              />
              <span className="font-heading text-xl font-black">Quilla</span>
            </a>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              A learning platform designed for Professional and Subprofessional
              Philippine Civil Service Examination preparation.
            </p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            Independent. Purposeful. Built for steady progress.
          </p>
        </div>
      </footer>
    </LandingAnimation>
  );
}
