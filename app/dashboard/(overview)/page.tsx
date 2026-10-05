import { requireCompany } from "@/app/lib/auth-guard";
import { lusitana } from "@/lib/fonts";

export default async function Page() {
  await requireCompany({ returnTo: "/dashboard" });

  return (
    <main>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        Dashboard
      </h1>
    </main>
  );
}
