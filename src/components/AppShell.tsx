import AppSidebar from "@/components/AppSidebar";
import DashboardTopBar from "@/components/DashboardTopBar";
import { SidebarProvider } from "@/components/SidebarContext";
import { PlatformContent, PlatformShell } from "@/components/ui/platform";

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PlatformShell>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <AppSidebar />

          <main className="flex-1 min-w-0">
            <DashboardTopBar title={title} />

            <PlatformContent className="pt-6 md:pt-8">
              {children}
            </PlatformContent>
          </main>
        </div>
      </SidebarProvider>
    </PlatformShell>
  );
}
