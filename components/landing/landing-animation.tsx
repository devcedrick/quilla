"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const motionTargetSelector = "[data-motion-target]";
const motionSectionSelector = "[data-motion-section]";
const animatedProperties = "transform,transformOrigin,opacity,willChange";

type MotionConditions = {
  isDesktop: boolean;
  isMobile: boolean;
  isTablet: boolean;
  reduceMotion: boolean;
};

type MotionMode = "desktop" | "mobile" | "tablet";

type MotionProfile = {
  horizontal: number;
  heroScrub: number;
  mode: MotionMode;
  scale: number;
  sectionScrub: number;
  vertical: number;
};

function getSection(root: HTMLElement, name: string) {
  return root.querySelector<HTMLElement>(`[data-motion-section="${name}"]`);
}

function getTargets(section: HTMLElement, name: string) {
  return gsap.utils.toArray<HTMLElement>(
    section.querySelectorAll(`[data-motion-target="${name}"]`),
  );
}

function clearAnimatedStyles(root: HTMLElement) {
  const targets = gsap.utils.toArray<HTMLElement>(
    root.querySelectorAll(motionTargetSelector),
  );

  if (targets.length > 0) {
    gsap.set(targets, { clearProps: animatedProperties });
  }
}

function getMotionProfile({
  isDesktop,
  isTablet,
}: MotionConditions): MotionProfile {
  if (isDesktop) {
    return {
      horizontal: 32,
      heroScrub: 0.6,
      mode: "desktop",
      scale: 0.965,
      sectionScrub: 0.5,
      vertical: 40,
    };
  }

  if (isTablet) {
    return {
      horizontal: 18,
      heroScrub: 0.4,
      mode: "tablet",
      scale: 0.98,
      sectionScrub: 0.35,
      vertical: 28,
    };
  }

  return {
    horizontal: 0,
    heroScrub: 0.25,
    mode: "mobile",
    scale: 0.985,
    sectionScrub: 0.25,
    vertical: 20,
  };
}

function startsBelowViewport(section: HTMLElement) {
  return section.getBoundingClientRect().top >= window.innerHeight;
}

export function LandingAnimation({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;

      if (!root || !contextSafe) {
        return;
      }

      let cancelled = false;
      const frameIds = new Set<number>();
      const media = gsap.matchMedia();
      const refresh = contextSafe(() => ScrollTrigger.refresh());
      const scheduleRefresh = () => {
        const frameId = window.requestAnimationFrame(() => {
          frameIds.delete(frameId);
          if (!cancelled) {
            refresh();
          }
        });
        frameIds.add(frameId);
      };
      const onWindowLoad = contextSafe(scheduleRefresh);

      if (document.readyState === "complete") {
        scheduleRefresh();
      } else {
        window.addEventListener("load", onWindowLoad, { once: true });
      }

      if (document.fonts) {
        const onFontsReady = contextSafe(() => {
          if (!cancelled) {
            scheduleRefresh();
          }
        });
        void document.fonts.ready.then(onFontsReady);
      }

      media.add(
        {
          isDesktop:
            "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          isMobile:
            "(max-width: 639px) and (prefers-reduced-motion: no-preference)",
          isTablet:
            "(min-width: 640px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (mediaContext) => {
          const conditions = mediaContext.conditions as MotionConditions;
          const sections = gsap.utils.toArray<HTMLElement>(
            root.querySelectorAll(motionSectionSelector),
          );
          const ownedTimelines: gsap.core.Timeline[] = [];

          clearAnimatedStyles(root);
          sections.forEach((section) => {
            delete section.dataset.motionProgress;
            delete section.dataset.motionState;
          });
          delete root.dataset.motionReady;

          if (conditions.reduceMotion) {
            root.dataset.motionMode = "reduced";
            root.dataset.motionReady = "true";

            return () => {
              clearAnimatedStyles(root);
              sections.forEach((section) => {
                delete section.dataset.motionProgress;
                delete section.dataset.motionState;
              });
            };
          }

          const profile = getMotionProfile(conditions);
          const animateCardOpacity = profile.mode !== "mobile";
          const getSectionEnd = (defaultEnd: string) =>
            profile.mode === "desktop" ? "clamp(top 42%)" : defaultEnd;
          const setSectionState = (section: HTMLElement, state: string) => {
            section.dataset.motionState = state;
          };
          const promoteTargets = (targets: HTMLElement[]) => {
            gsap.set(targets, { willChange: "transform, opacity" });
          };
          const releaseTargets = (targets: HTMLElement[]) => {
            gsap.set(targets, { clearProps: "willChange" });
          };
          const createSectionTimeline = (
            section: HTMLElement,
            targets: HTMLElement[],
            start: string,
            end: string,
          ) => {
            const onEnter = contextSafe(() => {
              promoteTargets(targets);
              setSectionState(section, "active");
            });
            const onLeave = contextSafe(() => {
              releaseTargets(targets);
              setSectionState(section, "complete");
            });
            const onEnterBack = contextSafe(() => {
              promoteTargets(targets);
              setSectionState(section, "active");
            });
            const onLeaveBack = contextSafe(() => {
              releaseTargets(targets);
              setSectionState(section, "prepared");
            });
            const onUpdate = contextSafe((trigger: ScrollTrigger) => {
              section.dataset.motionProgress = trigger.progress.toFixed(3);
            });
            const timeline = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                end,
                invalidateOnRefresh: true,
                onEnter,
                onEnterBack,
                onLeave,
                onLeaveBack,
                onUpdate,
                scrub: profile.sectionScrub,
                start,
                trigger: section,
              },
            });

            ownedTimelines.push(timeline);
            section.dataset.motionProgress = "0.000";
            section.dataset.motionState = "prepared";
            return timeline;
          };

          try {
            const hero = getSection(root, "hero");
            if (hero) {
              const heroCopy = [
                ...getTargets(hero, "hero-eyebrow"),
                ...getTargets(hero, "hero-title"),
                ...getTargets(hero, "hero-summary"),
                ...getTargets(hero, "hero-note"),
              ];
              const heroActions = getTargets(hero, "hero-actions");
              const heroStage = getTargets(hero, "hero-stage");
              const heroOrbit = getTargets(hero, "hero-orbit");
              const heroCard = getTargets(hero, "hero-card");
              const heroUnderline = getTargets(hero, "hero-underline");
              const heroTargets = [
                ...heroCopy,
                ...heroActions,
                ...heroStage,
                ...heroOrbit,
                ...heroCard,
                ...heroUnderline,
              ];
              const onEnter = contextSafe(() => {
                promoteTargets(heroTargets);
                setSectionState(hero, "active");
              });
              const onLeave = contextSafe(() => {
                releaseTargets(heroTargets);
                setSectionState(hero, "complete");
              });
              const onEnterBack = contextSafe(() => {
                promoteTargets(heroTargets);
                setSectionState(hero, "active");
              });
              const onLeaveBack = contextSafe(() => {
                releaseTargets(heroTargets);
                setSectionState(hero, "settled");
              });
              const onUpdate = contextSafe((trigger: ScrollTrigger) => {
                hero.dataset.motionProgress = trigger.progress.toFixed(3);
              });
              const heroTimeline = gsap.timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  end: "clamp(bottom top)",
                  invalidateOnRefresh: true,
                  onEnter,
                  onEnterBack,
                  onLeave,
                  onLeaveBack,
                  onUpdate,
                  scrub: profile.heroScrub,
                  start: "clamp(top top)",
                  trigger: hero,
                },
              });

              heroTimeline
                .to(heroCopy, { opacity: 0.84, y: -profile.vertical * 0.35 }, 0)
                .to(heroActions, { y: -profile.vertical * 0.2 }, 0)
                .to(
                  heroStage,
                  {
                    scale: profile.mode === "desktop" ? 1.025 : 1.015,
                    x: profile.horizontal * 0.5,
                    y: -profile.vertical * 0.7,
                  },
                  0,
                )
                .to(
                  heroOrbit,
                  {
                    rotation: profile.mode === "mobile" ? 0 : 8,
                    scale: profile.mode === "desktop" ? 1.1 : 1.06,
                  },
                  0,
                )
                .to(
                  heroCard,
                  {
                    scale: profile.mode === "desktop" ? 0.98 : 0.99,
                    x: -profile.horizontal * 0.25,
                    y: profile.vertical * 0.6,
                  },
                  0,
                )
                .to(
                  heroUnderline,
                  { scaleX: 1.06, transformOrigin: "left center" },
                  0,
                );

              ownedTimelines.push(heroTimeline);
              hero.dataset.motionProgress = "0.000";
              hero.dataset.motionState = "settled";
            }

            const journey = getSection(root, "journey");
            if (journey) {
              const intro = getTargets(journey, "journey-intro");
              const items = getTargets(journey, "journey-item");
              const targets = [...intro, ...items];

              if (startsBelowViewport(journey)) {
                gsap.set(intro, { opacity: 0.45, y: profile.vertical * 0.8 });
                gsap.set(items, {
                  ...(animateCardOpacity ? { opacity: 0.28 } : {}),
                  scale: profile.scale,
                  y: profile.vertical,
                });
                createSectionTimeline(
                  journey,
                  targets,
                  "clamp(top 88%)",
                  getSectionEnd("clamp(bottom 38%)"),
                )
                  .to(intro, { duration: 0.28, opacity: 1, y: 0 }, 0)
                  .to(
                    items,
                    {
                      duration: 0.7,
                      ...(animateCardOpacity ? { opacity: 1 } : {}),
                      scale: 1,
                      stagger: 0.12,
                      y: 0,
                    },
                    0.16,
                  );
              } else {
                journey.dataset.motionState = "settled";
              }
            }

            const levels = getSection(root, "levels");
            if (levels) {
              const intro = getTargets(levels, "levels-intro");
              const shared = getTargets(levels, "levels-shared");
              const cards = getTargets(levels, "levels-card");
              const targets = [...intro, ...shared, ...cards];

              if (startsBelowViewport(levels)) {
                gsap.set(intro, { opacity: 0.45, y: profile.vertical * 0.7 });
                gsap.set(shared, {
                  ...(animateCardOpacity ? { opacity: 0.32 } : {}),
                  scale: profile.scale,
                  y: profile.vertical * 0.75,
                });
                cards.forEach((card, index) => {
                  gsap.set(card, {
                    ...(animateCardOpacity ? { opacity: 0.24 } : {}),
                    scale: profile.scale,
                    x: profile.horizontal * (index === 0 ? -1 : 1),
                    y: profile.vertical,
                  });
                });
                createSectionTimeline(
                  levels,
                  targets,
                  "clamp(top 86%)",
                  getSectionEnd("clamp(bottom 42%)"),
                )
                  .to(intro, { duration: 0.24, opacity: 1, y: 0 }, 0)
                  .to(
                    shared,
                    {
                      duration: 0.34,
                      ...(animateCardOpacity ? { opacity: 1 } : {}),
                      scale: 1,
                      y: 0,
                    },
                    0.12,
                  )
                  .to(
                    cards,
                    {
                      duration: 0.58,
                      ...(animateCardOpacity ? { opacity: 1 } : {}),
                      scale: 1,
                      stagger: 0.12,
                      x: 0,
                      y: 0,
                    },
                    0.28,
                  );
              } else {
                levels.dataset.motionState = "settled";
              }
            }

            const benefits = getSection(root, "benefits");
            if (benefits) {
              const intro = getTargets(benefits, "benefits-intro");
              const cards = getTargets(benefits, "benefits-card");
              const targets = [...intro, ...cards];

              if (startsBelowViewport(benefits)) {
                gsap.set(intro, { opacity: 0.45, y: profile.vertical * 0.7 });
                cards.forEach((card, index) => {
                  gsap.set(card, {
                    ...(animateCardOpacity ? { opacity: 0.25 } : {}),
                    scale:
                      index === 1
                        ? Math.max(0.94, profile.scale - 0.01)
                        : profile.scale,
                    y: profile.vertical,
                  });
                });
                createSectionTimeline(
                  benefits,
                  targets,
                  "clamp(top 86%)",
                  getSectionEnd("clamp(bottom 42%)"),
                )
                  .to(intro, { duration: 0.28, opacity: 1, y: 0 }, 0)
                  .to(
                    cards,
                    {
                      duration: 0.68,
                      ...(animateCardOpacity ? { opacity: 1 } : {}),
                      scale: 1,
                      stagger: 0.12,
                      y: 0,
                    },
                    0.18,
                  );
              } else {
                benefits.dataset.motionState = "settled";
              }
            }

            const trust = getSection(root, "trust");
            if (trust) {
              const intro = getTargets(trust, "trust-intro");
              const items = getTargets(trust, "trust-item");
              const targets = [...intro, ...items];

              if (startsBelowViewport(trust)) {
                gsap.set(intro, { opacity: 0.5, y: profile.vertical * 0.6 });
                gsap.set(items, {
                  ...(animateCardOpacity ? { opacity: 0.24 } : {}),
                  scale: profile.scale,
                  y: profile.vertical,
                });
                createSectionTimeline(
                  trust,
                  targets,
                  "clamp(top 86%)",
                  getSectionEnd("clamp(bottom 42%)"),
                )
                  .to(intro, { duration: 0.3, opacity: 1, y: 0 }, 0)
                  .to(
                    items,
                    {
                      duration: 0.72,
                      ...(animateCardOpacity ? { opacity: 1 } : {}),
                      scale: 1,
                      stagger: 0.12,
                      y: 0,
                    },
                    0.16,
                  );
              } else {
                trust.dataset.motionState = "settled";
              }
            }

            const callToAction = getSection(root, "cta");
            if (callToAction) {
              const card = getTargets(callToAction, "cta-card");

              if (startsBelowViewport(callToAction)) {
                gsap.set(card, {
                  scale: profile.scale,
                  y: profile.vertical * 0.8,
                });
                createSectionTimeline(
                  callToAction,
                  card,
                  "clamp(top 90%)",
                  "clamp(bottom 65%)",
                ).to(card, { duration: 1, scale: 1, y: 0 }, 0);
              } else {
                callToAction.dataset.motionState = "settled";
              }
            }

            root.dataset.motionMode = profile.mode;
            root.dataset.motionReady = "true";
          } catch {
            ownedTimelines.forEach((timeline) => timeline.kill());
            clearAnimatedStyles(root);
            sections.forEach((section) => {
              delete section.dataset.motionProgress;
              section.dataset.motionState = "settled";
            });
            root.dataset.motionMode = "fallback";
            root.dataset.motionReady = "true";
          }

          return () => {
            sections.forEach((section) => {
              delete section.dataset.motionProgress;
              delete section.dataset.motionState;
            });
          };
        },
      );

      return () => {
        cancelled = true;
        window.removeEventListener("load", onWindowLoad);
        frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
        frameIds.clear();
        media.revert();
        delete root.dataset.motionMode;
        delete root.dataset.motionReady;
      };
    },
    { scope: rootRef },
  );

  return (
    <div
      className="min-h-screen min-w-0 overflow-x-clip bg-background text-foreground"
      data-motion-root
      data-testid="landing-motion-root"
      ref={rootRef}
    >
      {children}
    </div>
  );
}
