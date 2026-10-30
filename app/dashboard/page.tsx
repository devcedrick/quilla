import type { Metadata } from "next";
import { PreparationPage } from "@/components/preparation/preparation-page";

export const metadata: Metadata = {
  title: "Your account | Quilla",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <PreparationPage kind="dashboard" />;
}
