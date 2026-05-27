import { requireCompany } from "@/app/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { fetchCurrentUser } from "../lib/data";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireCompany は page レベル UX ガード: 事業所未選択なら data fetch 前に redirect して
  // 描画チラつきを防ぐ。security backstop は各 runScopedService 自身。
  // 設計詳細: docs/adr/0002-company-data-scoping.md
  const [, currentUser] = await Promise.all([
    requireCompany({ returnTo: "/dashboard" }),
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
