import type { QuestionContent } from "@/convex/lib/questionContent";
import {
  difficultyLabels,
  languageLabels,
  levelLabels,
  moduleLabels,
  originLabels,
} from "@/lib/admin/question-options";

export function QuestionContentPreview({
  content,
}: {
  content: QuestionContent;
}) {
  return (
    <section aria-labelledby="question-content-title" className="space-y-5">
      <h2
        id="question-content-title"
        className="font-heading text-2xl font-semibold"
      >
        Immutable content
      </h2>
      <dl className="grid gap-3 rounded-2xl border border-border bg-background p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Family
          </dt>
          <dd className="font-semibold">{content.family}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Module
          </dt>
          <dd className="font-semibold">{moduleLabels[content.module]}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Level
          </dt>
          <dd className="font-semibold">
            {content.levelApplicability
              .map((level) => levelLabels[level])
              .join(" + ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Language
          </dt>
          <dd className="font-semibold">{languageLabels[content.language]}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Subject
          </dt>
          <dd className="font-semibold">{content.subjectId}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Subtopic
          </dt>
          <dd className="font-semibold">{content.subtopicId}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Concept
          </dt>
          <dd className="font-semibold">{content.conceptId}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Difficulty
          </dt>
          <dd className="font-semibold">
            {difficultyLabels[content.difficulty]}
          </dd>
        </div>
      </dl>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Stem
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">
          {content.stem}
        </p>
      </div>
      <ol className="space-y-2">
        {content.choices.map((choice) => {
          const correct = choice.choiceId === content.correctChoiceId;
          return (
            <li
              key={choice.choiceId}
              className="flex gap-3 rounded-xl border border-border bg-background p-3"
            >
              <span className="font-bold uppercase">{choice.choiceId}.</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {choice.text}
              </span>
              {correct && (
                <span className="self-start rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  Correct answer
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Explanation
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
          {content.explanation}
        </p>
      </div>
      <dl className="grid gap-3 rounded-2xl border border-border bg-background p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Origin
          </dt>
          <dd className="font-semibold">
            {originLabels[content.provenance.kind]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Author
          </dt>
          <dd className="font-semibold">{content.provenance.author}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Authoring assistance
          </dt>
          <dd>{content.provenance.assistance}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Sources
          </dt>
          <dd>
            {content.provenance.sources.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {content.provenance.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            ) : (
              "No sources recorded"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
