import "@/app/globals.css";
import { inter } from "@/lib/fonts";
import FlashToaster from "@/lib/flash-toaster";
import { ReactNode } from "react";
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
