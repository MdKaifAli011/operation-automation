import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div
        className="flex min-h-screen flex-col pl-[60px] transition-[padding] duration-150 ease-in-out"
        style={{ marginLeft: 0 }}
      >
        <Header />
        <main className="flex-1 overflow-auto bg-white p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
