import { redirect } from "next/navigation";

/** @deprecated Use /exams-subjects */
export default function SubjectsPageRedirect() {
  redirect("/exams-subjects");
}
