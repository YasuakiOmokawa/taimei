"use client";

import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Bell, ChevronsUpDown, CreditCard, Sparkles } from "lucide-react";
import { CurrentUser } from "@/app/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getInitials } from "@/lib/initials";

// 「設定」リンクは taimei-auth の /account SPA を新規タブで開く (ADR-008)。
// 戻り link を実装しない分、新規タブを閉じれば自然に dashboard に戻れる UX。
// rel="noopener noreferrer" は tabnabbing 防止の必須セキュリティ要件。
// `||` で truthy fallback: 空文字を fallback 対象にすることで、incident 時に
// NEXT_PUBLIC_AUTH_URL='' に切替えると href が空文字 = 「クリック無効化」になる運用 (ADR-008)。
// `??` は null/undefined のみ catch するため空文字を素通りさせて誤遷移を起こす。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL || "https://auth.taimei-code.com";

export function NavUser({ image, name, email }: CurrentUser) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={image} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={image} alt={name} />
                  <AvatarFallback className="rounded-lg">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Proプランにアップグレード
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {/* asChild で <a> に menuitem role を merge する。<a> で <DropdownMenuItem> を
                  wrap するとキーボード Enter で navigate しない Radix anti-pattern になる。 */}
              <DropdownMenuItem asChild>
                <a
                  href={`${AUTH_URL}/account`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Cog6ToothIcon />
                  設定
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                支払い
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                通知
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
