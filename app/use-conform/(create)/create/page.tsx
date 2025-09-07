import Form from "@/app/ui/use-conform/create/form";
import { runService } from "@/app/services";
import { Tag2Service } from "@/app/services/tag2_service";
import { Either } from "effect";

export default async function Page() {
  const tag2sEither = await runService(() => Tag2Service.findAll());

  if (Either.isLeft(tag2sEither)) {
    return <div>{tag2sEither.left.toString()}</div>;
  }

  return (
    <main>
      <table className="mb-4 border-separate border border-gray-400">
        <thead>
          <tr>
            <th className="border">id</th>
            <th className="border">name</th>
            <th className="border">created at</th>
            <th className="border">updated at</th>
          </tr>
        </thead>
        <tbody>
          {tag2sEither.right.map((tag2) => (
            <tr key={tag2.id}>
              <td className="border">{tag2.id}</td>
              <td className="border">{tag2.name}</td>
              <td className="border">{tag2.createdAt.toString()}</td>
              <td className="border">{tag2.updatedAt.toString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Form />
    </main>
  );
}
