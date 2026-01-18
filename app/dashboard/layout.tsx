import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { fetchCurrentUser } from "@/app/lib/data";
import { verifySession } from "@/app/lib/auth-guard";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [, currentUser] = await Promise.all([
    verifySession({ returnTo: "/dashboard" }),
    fetchCurrentUser(),
  ]);

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar currentUser={currentUser} />
          <SidebarInset>
            <div className="flex-grow p-6 md:overflow-auto md:p-12">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
