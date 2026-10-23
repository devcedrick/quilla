"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

export function WelcomeMascot() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="relative w-full">
      <style href="quilla-auth-kuwi-motion" precedence="default">{`
        .auth-kuwi-eyelid {
          transform: scaleY(0);
          transform-box: fill-box;
          transform-origin: center top;
        }
        @keyframes auth-kuwi-blink {
          0%, 94%, 98%, 100% { transform: scaleY(0); }
          95.5%, 96.5% { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .auth-kuwi-eyelid {
            animation: auth-kuwi-blink 6.4s ease-in-out infinite;
          }
        }
      `}</style>
      <div className="lg:py-4">
        <div className="relative" data-testid="welcome-mascot-art">
          <Image
            src="/brand/kuwi/kuwi-auth-welcome.svg"
            width={1368}
            height={1150}
            alt=""
            aria-hidden="true"
            className="relative h-auto w-full"
          />
          {/* Eye coordinates use the approved artwork's native coordinate space.
              Keep this additive rig separate from the reproducible traced asset. */}
          <svg
            viewBox="0 0 1368 1150"
            aria-hidden="true"
            focusable="false"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <g
              data-testid="kuwi-eyelid-near"
              className="auth-kuwi-eyelid"
              style={{ animationPlayState: paused ? "paused" : "running" }}
            >
              <path
                d="M646 470 C628 440 640 397 666 382 C691 362 721 365 741 391 C764 417 768 469 749 496 C727 515 684 511 662 493 Z"
                fill="#FCF8EF"
              />
              <path
                d="M651 441 Q698 469 748 436"
                fill="none"
                stroke="#020E1A"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </g>
            <g
              data-testid="kuwi-eyelid-far"
              className="auth-kuwi-eyelid"
              style={{ animationPlayState: paused ? "paused" : "running" }}
            >
              <path
                d="M871 330 C878 300 899 291 917 307 C940 327 947 373 940 405 C937 424 924 437 910 436 C891 436 875 419 871 398 C865 376 865 350 871 330 Z"
                fill="#FCF8EF"
              />
              <path
                d="M879 371 Q907 394 934 369"
                fill="none"
                stroke="#020E1A"
                strokeWidth="9"
                strokeLinecap="round"
              />
            </g>
          </svg>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-label={
          paused ? "Resume mascot animation" : "Pause mascot animation"
        }
        className="absolute -right-2 -bottom-3 inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current motion-reduce:hidden lg:right-0 lg:bottom-0 lg:text-primary-foreground lg:hover:bg-primary-foreground/10"
      >
        {paused ? (
          <Play size={16} aria-hidden="true" />
        ) : (
          <Pause size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
