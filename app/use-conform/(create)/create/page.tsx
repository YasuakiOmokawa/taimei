import Form from "@/app/ui/use-conform/create/form";
import { runService } from "@/app/services";
import { Tag2Service } from "@/app/services/tag2_service";
import { Either } from "effect";
import { dateFormatter } from "@/dateFormatter";

export default async function Page() {
  const tag2sOrError = await runService(() => Tag2Service.findAll());

  if (Either.isLeft(tag2sOrError)) {
    return <div>{tag2sOrError.toString()}</div>;
  }

  const tag2One = tag2sOrError.right.at(0);
  if (!tag2One) {
    return <div>no exists tag2</div>;
  }

  // const tag2OrError = await runService(() => Tag2Service.find(tag2One.id));
  const tag2OrError = await runService(() => Tag2Service.find("a"));
  // const tag2OrError = await runService(() =>
  //   Tag2Service.find(self.crypto.randomUUID())
  // );

  if (Either.isLeft(tag2OrError)) {
    const err = tag2OrError.left;
    switch (err._tag) {
      case "Tag2RepositoryError":
        return <div>{err.message}</div>;
      case "Tag2NotFound":
        return <div>{err.message}</div>;
      case "Tag2ParseError":
        return <div>{err.message}</div>;
      default:
        return <div>unexpected tag2service error</div>;
    }
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
          {tag2sOrError.right.map((tag2) => (
            <tr key={tag2.id}>
              <td className="border">{tag2.id}</td>
              <td className="border">{tag2.name}</td>
              <td className="border">{dateFormatter.format(tag2.createdAt)}</td>
              <td className="border">{dateFormatter.format(tag2.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 ml-8">
        <ul className="list-disc" key={tag2OrError.right.id}>
          <li>{tag2OrError.right.id}</li>
          <li>{tag2OrError.right.name}</li>
          <li>{dateFormatter.format(tag2OrError.right.createdAt)}</li>
          <li>{dateFormatter.format(tag2OrError.right.updatedAt)}</li>
        </ul>
      </div>
      <Form />
    </main>
  );
}
