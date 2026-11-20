import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { QuestionForm } from "@/components/admin/question-form";

export const metadata: Metadata = {
  title: "New question | Quilla admin",
  robots: { index: false, follow: false },
};

export default function AdminNewQuestionPage() {
  return (
    <AdminGate
      returnTo="/admin/questions/new"
      title="New question"
      description="Create a canonical question and its first immutable draft version. The draft can enter review only after it is saved."
      current="new"
    >
      <QuestionForm mode="create" />
    </AdminGate>
  );
}
