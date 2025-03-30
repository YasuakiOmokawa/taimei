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
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <MyServiceLogo />
          </Link>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex gap-6">
            <Link
              href="/login"
              className="text-sm font-medium transition-colors hover:text-primary"
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
        <section className="w-full py-12 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    ソリューションって言えば
                    <br />
                    なんかそれっぽい
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    それが <MyServiceName />
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/signup">
                      <MyServiceName /> を試す
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <Image
                src={heroImage}
                width={500}
                height={500}
                alt="ヒーローイメージ"
                className="mx-auto aspect-square overflow-hidden rounded-xl object-cover"
              />
            </div>
          </div>
        </section>

        {/* サービスセクション */}
        <section id="service" className="w-full py-12 md:py-24 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                  <MyServiceName /> でできること
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl">
                  全人類待望のサービスです
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl gap-8 py-8 md:grid-cols-3">
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
                  className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm bg-background"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{service.title}</h3>
                  <p className="text-muted-foreground text-center">
                    {service.description}
                  </p>
                  <Button variant="link" asChild>
                    <Link href={`/service/${i + 1}`}>詳細を見る</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="w-full border-t bg-background py-6">
        <div className="container px-4 md:px-6">
          <div className="mt-8 border-t pt-8">
            <p className="text-xs text-muted-foreground text-center">
              &copy; {new Date().getFullYear()} <MyServiceName /> All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
