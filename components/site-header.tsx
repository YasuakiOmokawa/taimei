"use client";

import { SidebarIcon } from "lucide-react";
import Link from "next/link";

import MyServiceName from "@/components/my-service-name";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";

export function SiteHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="flex sticky top-0 z-50 w-full items-center border-b bg-background">
      <div className="flex h-[--header-height] w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          aria-label="サイドバーを開閉"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Link href="/dashboard" className="text-lg font-bold text-brand">
          <MyServiceName />
        </Link>
      </div>
    </header>
  );
}
