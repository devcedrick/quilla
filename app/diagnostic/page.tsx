import type { Metadata } from "next";
import { PreparationPage } from "@/components/preparation/preparation-page";
export const metadata: Metadata = {
  title: "Diagnostic next steps | Quilla",
  robots: { index: false, follow: false },
};
export default function DiagnosticPage() {
  return <PreparationPage kind="diagnostic" />;
}
