import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

type MagicLinkEmailProps = {
  url: string;
  appName: string;
};

export function MagicLinkEmail({ url, appName }: MagicLinkEmailProps) {
  return (
    <Html lang="ja">
      <Head />
      <Preview>
        {appName} へのログインリンク - 5分間有効
      </Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: {
                  50: "#eef2ff",
                  100: "#e0e7ff",
                  600: "#4f46e5",
                  700: "#4338ca",
                  800: "#3730a3",
                  900: "#312e81",
                },
              },
            },
          },
        }}
      >
        <Body className="mx-auto bg-slate-50 font-sans">
          {/* Header with brand */}
          <Container className="mx-auto max-w-[580px] px-4 py-8">
            <Section className="mb-8 text-center">
              <Text className="m-0 text-2xl font-bold tracking-tight text-brand-800">
                {appName}
              </Text>
            </Section>

            {/* Main card */}
            <Section className="rounded-2xl border border-slate-200 bg-white px-10 py-12 shadow-lg">
              {/* Icon */}
              <Section className="mb-6 text-center">
                <Text className="m-0 text-5xl">🔐</Text>
              </Section>

              <Heading className="m-0 mb-3 text-center text-2xl font-semibold tracking-tight text-slate-900">
                ログインリクエスト
              </Heading>

              <Text className="m-0 mb-8 text-center text-base leading-relaxed text-slate-500">
                {appName} へのログインリクエストを受け付けました
              </Text>

              <Hr className="mx-0 my-6 border-slate-100" />

              <Text className="m-0 mb-6 text-center text-sm leading-relaxed text-slate-600">
                以下のボタンをクリックしてログインを完了してください。
                <br />
                このリンクは
                <span className="font-semibold text-brand-700"> 5分間 </span>
                有効です。
              </Text>

              {/* CTA Button */}
              <Section className="my-8 text-center">
                <Button
                  href={url}
                  className="inline-block rounded-xl bg-brand-600 px-10 py-4 text-center text-base font-semibold text-white no-underline shadow-md"
                >
                  ログインする →
                </Button>
              </Section>

              {/* Security notice */}
              <Section className="mt-8 rounded-lg bg-slate-50 px-5 py-4">
                <Text className="m-0 text-center text-xs leading-relaxed text-slate-500">
                  🛡️ セキュリティのため、このリンクは1回のみ使用可能です。
                  <br />
                  心当たりのない場合は、このメールを無視してください。
                </Text>
              </Section>
            </Section>

            {/* Alternative link */}
            <Section className="mt-8 px-4">
              <Text className="m-0 mb-2 text-center text-xs text-slate-400">
                ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：
              </Text>
              <Text className="m-0 text-center">
                <Link
                  href={url}
                  className="break-all text-xs text-brand-600 underline"
                >
                  {url}
                </Link>
              </Text>
            </Section>

            {/* Footer */}
            <Section className="mt-12 border-t border-slate-200 pt-8">
              <Text className="m-0 text-center text-xs leading-relaxed text-slate-400">
                © {new Date().getFullYear()} {appName}. All rights reserved.
                <br />
                このメールは自動送信されています。返信はできません。
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
