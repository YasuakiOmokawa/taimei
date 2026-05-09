import { createAuthClient } from "@taimei-code/auth-client";
import { Effect } from "effect";
import { Email } from "@/app/domain/email";
import { UserNotFound, UserServiceError } from "./user-errors";

const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3100";
const serviceKey = process.env.AUTH_SERVICE_KEY;

export class UserService extends Effect.Service<UserService>()(
  "services/UserService",
  {
    effect: Effect.gen(function* () {
      const { userService } = createAuthClient({
        baseUrl: `${authServiceUrl}/rpc`,
        serviceKey,
      });

      return {
        existsByEmail: (email: Email) =>
          Effect.tryPromise({
            try: async () => {
              const result = await userService.findUserByEmail({
                email: email as string,
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
                email: email as string,
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

        update: (id: string, data: { name?: string; image?: string | null }) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: async () => {
                const res = await userService.updateUser({
                  userId: id,
                  name: data.name,
                  image: data.image ?? undefined,
                  clearImage: data.image === null,
                });
                if (!res.user) return undefined;

                return {
                  id: res.user.id,
                  name: res.user.name,
                  email: res.user.email,
                  emailVerified: res.user.emailVerified,
                  image: res.user.image ?? null,
                  createdAt: new Date(res.user.createdAt),
                  updatedAt: new Date(res.user.updatedAt),
                };
              },
              catch: (e) =>
                new UserServiceError({ message: `update failed: ${e}` }),
            });
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),

        delete: (id: string) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => userService.deleteUser({ userId: id }),
              catch: (e) =>
                new UserServiceError({ message: `delete failed: ${e}` }),
            });
            if (!result.success) {
              return yield* new UserNotFound({ id });
            }
          }),

        clearImage: (id: string) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: async () => {
                const res = await userService.updateUser({
                  userId: id,
                  clearImage: true,
                });
                if (!res.user) return undefined;

                return {
                  id: res.user.id,
                  name: res.user.name,
                  email: res.user.email,
                  emailVerified: res.user.emailVerified,
                  image: res.user.image ?? null,
                  createdAt: new Date(res.user.createdAt),
                  updatedAt: new Date(res.user.updatedAt),
                };
              },
              catch: (e) =>
                new UserServiceError({ message: `clearImage failed: ${e}` }),
            });
            if (!result) {
              return yield* new UserNotFound({ id });
            }
            return result;
          }),
      } as const;
    }),
  },
) {}
