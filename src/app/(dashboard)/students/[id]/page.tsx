import Link from "next/link";
import { StudentDetailPage } from "@/components/student/StudentDetailPage";
import { getLeadById } from "@/lib/data/leads";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StudentPage({ params }: Props) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) {
    return (
      <div className="rounded-none border border-[#e0e0e0] p-8 text-center">
        <p className="text-[#757575]">Student not found.</p>
        <Link href="/" className="mt-4 inline-block text-[#1565c0] underline">
          Back to Leads
        </Link>
      </div>
    );
  }

  return <StudentDetailPage key={lead.id} lead={lead} />;
}
