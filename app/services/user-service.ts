import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { AuthClient } from "./auth-client-service";
import { UserServiceError } from "./user-errors";

// account の identity mutation (name / image / 削除) は taimei-auth /account に集約済 (ADR-008)。
// 本 Service は read-only ACL として findByEmail / findById / existsByEmail を提供する。
export class UserService extends Effect.Service<UserService>()(
  "services/UserService",
  {
    effect: Effect.gen(function* () {
      const { userService } = yield* AuthClient;

      return {
        existsByEmail: (email: Email) =>
          Effect.tryPromise({
            try: async () => {
              const result = await userService.findUserByEmail({
                email: Email.asString(email),
              });
              return result.user !== undefined;
            },
            catch: (e) =>
              new UserServiceError({ message: `existsByEmail failed: ${e}` }),
          }),

        findByEmail: (email: Email) =>
          Effect.tryPromise({
            try: async () => {
              const result = await userService.findUserByEmail({
                email: Email.asString(email),
              });
              if (!result.user) return undefined;

              return {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                emailVerified: result.user.emailVerified,
                image: result.user.image ?? null,
                createdAt: new Date(result.user.createdAt),
                updatedAt: new Date(result.user.updatedAt),
              };
            },
            catch: (e) =>
              new UserServiceError({ message: `findByEmail failed: ${e}` }),
          }),

        findById: (id: string) =>
          Effect.tryPromise({
            try: async () => {
              const result = await userService.findUserById({ userId: id });
              if (!result.user) return undefined;

              return {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                emailVerified: result.user.emailVerified,
                image: result.user.image ?? null,
                createdAt: new Date(result.user.createdAt),
                updatedAt: new Date(result.user.updatedAt),
              };
            },
            catch: (e) =>
              new UserServiceError({ message: `findById failed: ${e}` }),
          }),
      } as const;
    }),
  },
) {}
