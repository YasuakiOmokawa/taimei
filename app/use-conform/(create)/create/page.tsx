import Form from "@/app/ui/use-conform/create/form";
import { runService } from "@/app/services";
import { Tag2Service } from "@/app/services/tag2_service";
import { Either } from "effect";

export default async function Page() {
  const tag2sEither = await runService(() => Tag2Service.findAll());

  if (Either.isLeft(tag2sEither)) {
    return <div>{tag2sEither.left.toString()}</div>;
  }

  const tag2One = tag2sEither.right.at(0);
  if (!tag2One) {
    return <div>no exists tag2</div>;
  }

  const tag2Either = await runService(() => Tag2Service.findById(tag2One.id));

  if (Either.isLeft(tag2Either)) {
    return <div>{tag2Either.left.toString()}</div>;
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
      <div className="mt-8 ml-8">
        <ul className="list-disc">
          <li>{tag2One.id}</li>
          <li>{tag2One.name}</li>
          <li>{tag2One.createdAt.toString()}</li>
          <li>{tag2One.updatedAt.toString()}</li>
        </ul>
      </div>
      <Form />
    </main>
  );
}
