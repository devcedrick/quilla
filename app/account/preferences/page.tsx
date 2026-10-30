import type { Metadata } from "next";
import { PreparationPage } from "@/components/preparation/preparation-page";
export const metadata: Metadata = {
  title: "Preparation preferences | Quilla",
  robots: { index: false, follow: false },
};
export default function PreferencesPage() {
  return <PreparationPage kind="preferences" />;
}
