import { Effect, Layer } from "effect";
import { UserRepository } from "./user-repository";

const makeUserService = Effect.gen(function* () {
  const repository = yield* UserRepository;

  return {
    existsByEmail: (email: string) => repository.existsByEmail(email),
    findByEmail: (email: string) => repository.findByEmail(email),
    findById: (id: string) => repository.findById(id),
  };
});

export class UserService extends Effect.Tag("services/UserService")<
  UserService,
  Effect.Effect.Success<typeof makeUserService>
>() {
  static Live = Layer.effect(this, makeUserService);
}
