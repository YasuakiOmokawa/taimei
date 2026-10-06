import { lusitana } from "@/lib/fonts";

export default function Page() {
  return (
    <main className="p-6 md:p-12">
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        準備中
      </h1>
      <p>taimei は公開の準備中です。この事業所ではまだ使えません</p>
    </main>
  );
}
