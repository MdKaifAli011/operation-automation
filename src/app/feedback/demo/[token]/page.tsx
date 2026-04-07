import { DemoTeacherFeedbackForm } from "./DemoTeacherFeedbackForm";

export default async function DemoFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DemoTeacherFeedbackForm token={token} />;
}
