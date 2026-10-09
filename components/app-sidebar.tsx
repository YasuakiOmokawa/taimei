"use client";

import { UserGroupIcon, UsersIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import * as React from "react";
import { CurrentUser } from "@/app/lib/data";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";

type Props = {
  currentUser: CurrentUser;
} & React.ComponentProps<typeof Sidebar>;

const navMainItems = [
  { title: "チーム", url: "/dashboard/teams", icon: UserGroupIcon },
  { title: "メンバー", url: "/dashboard/members", icon: UsersIcon },
];

export function AppSidebar({ currentUser, ...props }: Props) {
  return (
    <Sidebar
      className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
      {...props}
    >
      <SidebarContent>
        <NavMain items={navMainItems} />
      </SidebarContent>
      <SidebarFooter>
        <Link
          href="/privacy"
          className="px-2 text-xs text-muted-foreground underline underline-offset-4"
        >
          プライバシーポリシー
        </Link>
        <NavUser {...currentUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
