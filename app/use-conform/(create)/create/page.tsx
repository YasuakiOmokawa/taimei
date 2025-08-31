import Form from "@/app/ui/use-conform/create/form";
import { runService } from "@/app/services";
import { Tag2Service } from "@/app/services/tag2_service";
import { Either } from "effect";

export default async function Page() {
  const tag2sEither = await runService(() => Tag2Service.getAll());

  if (Either.isLeft(tag2sEither)) {
    return <div>{tag2sEither.left.toString()}</div>;
  }

  return (
    <main>
      {tag2sEither.right.map((tag2) => (
        <li key={tag2.id}>
          <div>{tag2.id}</div>
          <div>{tag2.name}</div>
          <div>{tag2.createdAt}</div>
          <div>{tag2.updatedAt}</div>
        </li>
      ))}
      <Form />
    </main>
  );
}
