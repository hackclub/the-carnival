import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <Header showSectionLinks={false} />

          <div className="px-6 md:px-10 pb-20">
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {title}
                </h1>
              </div>

              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


