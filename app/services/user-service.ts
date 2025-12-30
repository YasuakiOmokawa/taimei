import { Data, Effect } from "effect";
import { UserRepository } from "./user-repository";

export class UserService extends Effect.Service<UserService>()(
  "services/UserService",
  {
    effect: Effect.gen(function* () {
      const repository = yield* UserRepository;

      return {
        existsByEmail: (email: string) => repository.existsByEmail(email),
        findByEmail: (email: string) => repository.findByEmail(email),
        findById: (id: string) => repository.findById(id),

        update: (id: string, data: { name?: string; image?: string | null }) =>
          Effect.gen(function* () {
            const result = yield* repository.update(id, data);
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),

        delete: (id: string) =>
          Effect.gen(function* () {
            const existing = yield* repository.findById(id);
            if (!existing) {
              return yield* new UserNotFound({ id });
            }
            yield* repository.delete(id);
          }),

        clearImage: (id: string) =>
          Effect.gen(function* () {
            const result = yield* repository.update(id, { image: null });
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),
      } as const;
    }),
  }
) {}

export class UserNotFound extends Data.TaggedError("UserNotFound")<{
  id: string;
}> {}
