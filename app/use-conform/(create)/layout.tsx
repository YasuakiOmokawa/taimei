import { ReactNode } from "react";
import FormProvider from "@/app/use-conform/components/form-provider";

export default async function Layout({ children }: { children: ReactNode }) {
  return <FormProvider>{children}</FormProvider>;
}
