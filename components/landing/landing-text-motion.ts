import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

type TextMotionOptions = {
  mobile: boolean;
  desktop: boolean;
  entrancePlayed: boolean;
  onEntranceComplete: () => void;
};

function headingScrollPosition(heading: HTMLElement, viewportRatio: number) {
  let top = 0;
  let element: HTMLElement | null = heading;
  while (element) {
    top += element.offsetTop;
    element = element.offsetParent as HTMLElement | null;
  }
  return gsap.utils.clamp(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
    top - window.innerHeight * viewportRatio,
  );
}

export function createLandingTextMotion(
  root: HTMLElement,
  options: TextMotionOptions,
) {
  const splits: SplitText[] = [];
  const animations: gsap.core.Animation[] = [];
  const restoreStyles: (() => void)[] = [];
  const hero = root.querySelector<HTMLElement>('[data-motion-section="hero"]');
  let disposed = false;
  let entranceComplete = options.entrancePlayed || window.scrollY > 8;

  const finishEntrance = () => {
    if (entranceComplete || disposed) return;
    entranceComplete = true;
    animations.forEach((animation) => animation.totalProgress(1));
    options.onEntranceComplete();
    if (hero) hero.dataset.textState = "complete";
  };
  const onHeroClick = (event: MouseEvent) => {
    if ((event.target as Element).closest("a")) finishEntrance();
  };
  const dispose = () => {
    disposed = true;
    window.removeEventListener("scroll", finishEntrance);
    hero?.removeEventListener("click", onHeroClick);
    animations.forEach((animation) => animation.kill());
    splits.forEach((split) => split.revert());
    restoreStyles.forEach((restore) => restore());
    root
      .querySelectorAll<HTMLElement>("[data-motion-text]")
      .forEach((element) => {
        delete element.dataset.textProgress;
      });
    if (hero) delete hero.dataset.textState;
  };

  try {
    const splitText = (
      element: HTMLElement,
      animate: (split: SplitText) => gsap.core.Animation,
    ) => {
      const previousWrap = element.style.textWrap;
      const underline = element.querySelector<HTMLElement>(
        '[data-motion-target="hero-underline"]',
      );
      // Keep decoration out of SplitText's text-node reconstruction.
      underline?.remove();
      const restoreUnderline = () => {
        if (underline)
          element.querySelector("[data-text-accent]")?.append(underline);
      };
      element.style.textWrap = "wrap";
      restoreStyles.push(() => {
        element.style.textWrap = previousWrap;
        restoreUnderline();
      });
      splits.push(
        SplitText.create(element, {
          type: "lines,words",
          mask: "lines",
          autoSplit: true,
          aria: "auto",
          ignore: "[data-motion-target=hero-underline]",
          linesClass: "motion-text-line",
          wordsClass: "motion-text-word",
          onSplit: (split) => {
            restoreUnderline();
            // SplitText owns re-split animations; never enter the parent React context here.
            split.masks.forEach((mask) => {
              const style = (mask as HTMLElement).style;
              style.overflowClipMargin = "0.15em";
            });
            return animate(split);
          },
        }),
      );
    };

    if (hero) {
      hero.dataset.textState = entranceComplete ? "complete" : "entering";
      if (entranceComplete) options.onEntranceComplete();
      if (!entranceComplete) {
        const title = hero.querySelector<HTMLElement>(
          "[data-motion-text=hero-title]",
        );
        const summary = hero.querySelector<HTMLElement>(
          "[data-motion-text=hero-summary]",
        );
        if (title)
          splitText(title, (split) => {
            const timeline = gsap.timeline();
            const accented = split.words.filter((word) =>
              word.closest("[data-text-accent]"),
            );
            timeline.from(
              split.words.filter((word) => !accented.includes(word)),
              {
                yPercent: 110,
                rotation: options.desktop ? 2 : 0,
                duration: options.mobile ? 0.55 : 0.75,
                stagger: options.mobile ? 0.03 : 0.045,
                ease: "power3.out",
              },
            );
            if (accented.length)
              timeline.fromTo(
                accented,
                { yPercent: 110 },
                {
                  yPercent: 0,
                  duration: options.mobile ? 0.65 : 0.85,
                  stagger: options.mobile ? 0.03 : 0.045,
                  ease: "power3.out",
                },
                options.mobile ? 0.21 : 0.315,
              );
            timeline.fromTo(
              hero.querySelectorAll('[data-motion-target="hero-underline"]'),
              { scaleX: 0 },
              { scaleX: 1, transformOrigin: "left center", duration: 0.45 },
              options.mobile ? 0.65 : 0.95,
            );
            if (entranceComplete) timeline.totalProgress(1);
            animations.push(timeline);
            return timeline;
          });
        if (summary)
          splitText(summary, (split) => {
            const tween = gsap.from(split.lines, {
              yPercent: 105,
              duration: options.mobile ? 0.45 : 0.55,
              stagger: { amount: 0.12 },
              delay: options.mobile ? 0.55 : 0.9,
              ease: "power3.out",
              onComplete: finishEntrance,
            });
            if (entranceComplete) tween.totalProgress(1);
            animations.push(tween);
            return tween;
          });
        animations.push(
          gsap.from(
            hero.querySelectorAll(
              "[data-motion-text=hero-eyebrow], [data-motion-text=hero-card-title]",
            ),
            {
              y: options.mobile ? 8 : 14,
              duration: 0.6,
              stagger: 0.15,
              ease: "power3.out",
            },
          ),
        );
        window.addEventListener("scroll", finishEntrance, { passive: true });
        hero.addEventListener("click", onHeroClick);
      }
    }

    root
      .querySelectorAll<HTMLElement>('[data-motion-text="section-title"]')
      .forEach((heading) => {
        if (heading.getBoundingClientRect().top < window.innerHeight) return;
        splitText(heading, (split) => {
          const tween = gsap.fromTo(
            split.words,
            { yPercent: 105 },
            {
              yPercent: 0,
              duration: 1,
              stagger: { amount: 0.25 },
              ease: "none",
              onUpdate: function () {
                heading.dataset.textProgress = this.progress().toFixed(3);
              },
              scrollTrigger: {
                trigger: heading,
                // Equivalent clamped heading positions without the CTA parent's animated transform.
                start: () => headingScrollPosition(heading, 0.9),
                end: () => headingScrollPosition(heading, 0.68),
                scrub: options.mobile ? 0.2 : 0.35,
              },
            },
          );
          return tween;
        });
      });
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
