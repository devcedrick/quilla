import type { Metadata } from "next";
import { PreparationPage } from "@/components/preparation/preparation-page";
export const metadata: Metadata = {
  title: "Choose your exam level | Quilla",
  robots: { index: false, follow: false },
};
export default function OnboardingPage() {
  return <PreparationPage kind="onboarding" />;
}
