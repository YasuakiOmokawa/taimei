declare const AuthServiceUnavailable_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "AuthServiceUnavailable";
} & Readonly<A>;
export declare class AuthServiceUnavailable extends AuthServiceUnavailable_base<{
    message: string;
    cause?: unknown;
}> {
}
declare const AuthServiceTimeout_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "AuthServiceTimeout";
} & Readonly<A>;
export declare class AuthServiceTimeout extends AuthServiceTimeout_base<{
    message: string;
    cause?: unknown;
}> {
}
declare const AuthServiceUnauthorized_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "AuthServiceUnauthorized";
} & Readonly<A>;
export declare class AuthServiceUnauthorized extends AuthServiceUnauthorized_base<{
    message: string;
}> {
}
export {};
//# sourceMappingURL=errors.d.ts.map