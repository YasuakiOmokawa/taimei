import Form from "@/app/ui/use-conform/create/form";
import { runService } from "@/app/services";
import { Tag2Service } from "@/app/services/tag2_service";
import { Cause, Exit } from "effect";
import { dateFormatter } from "@/dateFormatter";

export default async function Page() {
  const tag2sExit = await runService(() => Tag2Service.findAll());

  if (Exit.isFailure(tag2sExit)) {
    return <div>{tag2sExit.toString()}</div>;
  }

  const tag2One = tag2sExit.value.at(0);
  if (!tag2One) {
    return <div>no exists tag2</div>;
  }

  const tag2Exit = await runService(() => Tag2Service.find(tag2One.id));
  // const tag2Exit = await runService(() =>
  //   Tag2Service.find(self.crypto.randomUUID())
  // );

  if (Exit.isFailure(tag2Exit)) {
    if (Cause.isFailType(tag2Exit.cause)) {
      const err = tag2Exit.cause.error;
      switch (err._tag) {
        case "Tag2RepositoryError":
          return <div>{err.message}</div>;
        case "Tag2NotFound":
          return <div>{err.message}</div>;
        default:
          return <div>unexpected tag2service error</div>;
      }
    }
    return;
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
          {tag2sExit.value.map((tag2) => (
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
        <ul className="list-disc" key={tag2Exit.value.id}>
          <li>{tag2Exit.value.id}</li>
          <li>{tag2Exit.value.name}</li>
          <li>{dateFormatter.format(tag2Exit.value.createdAt)}</li>
          <li>{dateFormatter.format(tag2Exit.value.updatedAt)}</li>
        </ul>
      </div>
      <Form />
    </main>
  );
}
