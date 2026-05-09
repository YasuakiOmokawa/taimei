import "@/app/globals.css";
import { ReactNode } from "react";
import FlashToaster from "@/lib/flash-toaster";
import { inter } from "@/lib/fonts";
import Providers from "./providers";

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
        <FlashToaster />
      </body>
    </html>
  );
}
