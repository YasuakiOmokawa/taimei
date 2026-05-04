import { AuthServiceUnavailable, AuthServiceTimeout, AuthServiceUnauthorized } from "./errors";
type ClientOptions = {
    baseUrl: string;
    serviceKey?: string;
};
export declare function createAuthClient(options: ClientOptions): {
    authService: import("@connectrpc/connect").Client<import("@bufbuild/protobuf/codegenv2").GenService<{
        verifySession: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").VerifySessionRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").VerifySessionResponseSchema;
        };
        getUser: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").GetUserRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").GetUserResponseSchema;
        };
        findAccountByUserId: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").FindAccountByUserIdRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").FindAccountByUserIdResponseSchema;
        };
        signOut: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").SignOutRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").SignOutResponseSchema;
        };
        sendMagicLink: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").SendMagicLinkRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").SendMagicLinkResponseSchema;
        };
    }>>;
    userService: import("@connectrpc/connect").Client<import("@bufbuild/protobuf/codegenv2").GenService<{
        findUserByEmail: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").FindUserByEmailRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").FindUserByEmailResponseSchema;
        };
        findUserById: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").FindUserByIdRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").FindUserByIdResponseSchema;
        };
        updateUser: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").UpdateUserRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").UpdateUserResponseSchema;
        };
        deleteUser: {
            methodKind: "unary";
            input: typeof import("./gen/auth/v1/auth_pb").DeleteUserRequestSchema;
            output: typeof import("./gen/auth/v1/auth_pb").DeleteUserResponseSchema;
        };
    }>>;
};
export declare function mapConnectError(error: unknown): AuthServiceUnavailable | AuthServiceTimeout | AuthServiceUnauthorized;
export {};
//# sourceMappingURL=server.d.ts.map