import { authRoutes } from "./routes";

export type LandingSessionState = "signed_out" | "signed_in" | "unavailable";
export type LandingPlacement = "header" | "hero" | "closing";

/** Navigation hints only. The destination independently enforces access. */
export function landingAction(
  state: LandingSessionState,
  placement: LandingPlacement,
) {
  if (state !== "signed_out") {
    return {
      href: authRoutes.dashboard,
      label:
        state === "signed_in" ? "Go to your dashboard" : "Open your account",
      secondary: state === "unavailable" ? "Sign in" : null,
      description:
        "Return to your account and continue from where Quilla is available today.",
    };
  }
  return {
    href: authRoutes.signUp,
    label: placement === "closing" ? "Start preparing" : "Create your account",
    secondary:
      placement === "closing" ? "I already have an account" : "Sign in",
    description:
      "Create your account to begin the path toward a more focused, explainable CSE review routine.",
  };
}
