import "@/app/ui/global.css";
import { inter } from "@/app/ui/fonts";
import FlashToaster from "@/lib/flash-toaster";
import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import Providers from "./providers";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SessionProvider>
      <html>
        <body className={`${inter.className} antialiased`}>
          <Providers>{children}</Providers>
          <FlashToaster />
        </body>
      </html>
    </SessionProvider>
  );
}
