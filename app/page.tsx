"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import MyServiceName from "@/components/my-service-name";
import MyServiceLogo from "@/components/my-service-logo";
import heroImage from "@/app/ui/icons/hero-image.png";

export default function Page() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 lg:h-20 items-center justify-between max-w-7xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl lg:text-2xl"
          >
            <MyServiceLogo height={180} className="-z-10" />
          </Link>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex gap-8">
            <Link
              href="/login"
              className="text-base font-medium transition-colors hover:text-primary"
            >
              ログイン
            </Link>
          </nav>

          {/* モバイルメニューボタン */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">メニュー</span>
          </Button>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="md:hidden border-t">
            <nav className="container flex flex-col py-4">
              <Link
                href="/login"
                className="py-2 text-sm font-medium transition-colors hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                ログイン
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* ヒーローセクション */}
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 max-w-7xl mx-auto">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-16 xl:gap-24 items-center">
              <div className="flex flex-col justify-center space-y-4 lg:space-y-6">
                <div className="space-y-2 lg:space-y-4">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                    心安らかな
                    <br />
                    ソリューション
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl lg:text-2xl">
                    それが <MyServiceName />
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" className="text-base px-8 py-6" asChild>
                    <Link href="/signup">
                      <MyServiceName /> を試す
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <Image
                  src={heroImage || "/placeholder.svg"}
                  width={600}
                  height={600}
                  alt="ヒーローイメージ"
                  className="mx-auto aspect-square overflow-hidden rounded-xl object-cover lg:w-full lg:max-w-[600px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* サービスセクション */}
        <section
          id="service"
          className="w-full py-12 md:py-24 lg:py-32 bg-muted/50"
        >
          <div className="container px-4 md:px-6 max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-10 lg:mb-16">
              <div className="space-y-2 lg:space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl">
                  <MyServiceName /> でできること
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl">
                  全人類待望のサービスです
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-6xl gap-8 py-8 md:grid-cols-3 lg:gap-12">
              {[
                {
                  title: "癒し",
                  description: "忙しい現代人にやすらぎを。",
                },
                {
                  title: "収入アップ",
                  description: "フリーランスで年収1000万円。",
                },
                {
                  title: "斧投げ",
                  description: "物理的にマサカリを投げよう。",
                },
              ].map((service, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center space-y-4 rounded-lg border p-6 lg:p-8 shadow-sm bg-background hover:shadow-md transition-shadow"
                >
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-xl lg:text-2xl font-bold">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground text-center text-base lg:text-lg">
                    {service.description}
                  </p>
                  <Button variant="link" size="lg" className="mt-2" asChild>
                    <Link href={`/service/${i + 1}`}>詳細を見る</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="w-full border-t bg-background py-8 lg:py-12">
        <div className="container px-4 md:px-6 max-w-7xl mx-auto">
          <div className="mt-8 border-t pt-8">
            <p className="text-sm text-muted-foreground text-center">
              &copy; {new Date().getFullYear()} <MyServiceName /> All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
