import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";
import { QuestionBank } from "@/components/admin/question-bank";

export const metadata: Metadata = {
  title: "Question bank | Quilla admin",
  robots: { index: false, follow: false },
};

export default function AdminQuestionsPage() {
  return (
    <AdminGate
      returnTo="/admin/questions"
      title="Question bank"
      description="Search immutable question versions across every lifecycle state, then inspect, author, review, publish, or archive through actions the backend independently enforces."
      current="questions"
    >
      <QuestionBank />
    </AdminGate>
  );
}
