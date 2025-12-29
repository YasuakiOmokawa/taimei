import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

type WelcomeEmailProps = {
  appName: string;
  userName?: string | null;
  dashboardUrl: string;
};

export function WelcomeEmail({
  appName,
  userName,
  dashboardUrl,
}: WelcomeEmailProps) {
  const greeting = userName ? `${userName} さん、` : "";

  return (
    <Html lang="ja">
      <Head />
      <Preview>{appName} へようこそ！アカウント作成が完了しました</Preview>
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
          <Container className="mx-auto max-w-[580px] px-4 py-8">
            {/* Header with brand */}
            <Section className="mb-8 text-center">
              <Text className="m-0 text-2xl font-bold tracking-tight text-brand-800">
                {appName}
              </Text>
            </Section>

            {/* Main card */}
            <Section className="rounded-2xl border border-slate-200 bg-white px-10 py-12 shadow-lg">
              {/* Celebration icon */}
              <Section className="mb-6 text-center">
                <Text className="m-0 text-5xl">🎉</Text>
              </Section>

              <Heading className="m-0 mb-3 text-center text-2xl font-semibold tracking-tight text-slate-900">
                ようこそ！
              </Heading>

              <Text className="m-0 mb-8 text-center text-base leading-relaxed text-slate-500">
                {greeting}アカウント作成ありがとうございます
              </Text>

              <Hr className="mx-0 my-6 border-slate-100" />

              <Text className="m-0 mb-6 text-center text-sm leading-relaxed text-slate-600">
                {appName} をご利用いただきありがとうございます。
                <br />
                以下のボタンからダッシュボードにアクセスできます。
              </Text>

              {/* CTA Button */}
              <Section className="my-8 text-center">
                <Button
                  href={dashboardUrl}
                  className="inline-block rounded-xl bg-brand-600 px-10 py-4 text-center text-base font-semibold text-white no-underline shadow-md"
                >
                  ダッシュボードへ →
                </Button>
              </Section>

              {/* Support notice */}
              <Section className="mt-8 rounded-lg bg-brand-50 px-5 py-4">
                <Text className="m-0 text-center text-xs leading-relaxed text-slate-500">
                  ご不明な点がございましたら、お気軽にお問い合わせください。
                </Text>
              </Section>
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
