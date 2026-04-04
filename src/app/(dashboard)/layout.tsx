import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className="flex min-h-screen flex-col pl-[var(--sidebar-collapsed)] transition-[padding] duration-150 ease-in-out"
        style={{ marginLeft: 0 }}
      >
        <Header />
        <main className="flex-1 overflow-auto bg-slate-50/80 p-3 md:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
