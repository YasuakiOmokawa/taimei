import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { fetchCurrentUser } from "../lib/data";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const currentUser = await fetchCurrentUser();

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
