import { SettingSidebar } from "@/components/setting-sidebar";
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
    verifySession({ returnTo: "/setting" }),
    fetchCurrentUser(),
  ]);

  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <SettingSidebar currentUser={currentUser} />
          <SidebarInset>{children}</SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
