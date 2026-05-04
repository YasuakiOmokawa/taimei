import type { GenFile, GenMessage, GenService } from "@bufbuild/protobuf/codegenv2";
import type { Message } from "@bufbuild/protobuf";
/**
 * Describes the file auth/v1/auth.proto.
 */
export declare const file_auth_v1_auth: GenFile;
/**
 * 共通メッセージ
 *
 * @generated from message auth.v1.User
 */
export type User = Message<"auth.v1.User"> & {
    /**
     * @generated from field: string id = 1;
     */
    id: string;
    /**
     * @generated from field: string name = 2;
     */
    name: string;
    /**
     * @generated from field: string email = 3;
     */
    email: string;
    /**
     * @generated from field: bool email_verified = 4;
     */
    emailVerified: boolean;
    /**
     * @generated from field: optional string image = 5;
     */
    image?: string;
    /**
     * @generated from field: string created_at = 6;
     */
    createdAt: string;
    /**
     * @generated from field: string updated_at = 7;
     */
    updatedAt: string;
};
/**
 * Describes the message auth.v1.User.
 * Use `create(UserSchema)` to create a new message.
 */
export declare const UserSchema: GenMessage<User>;
/**
 * @generated from message auth.v1.Session
 */
export type Session = Message<"auth.v1.Session"> & {
    /**
     * @generated from field: string id = 1;
     */
    id: string;
    /**
     * @generated from field: string token = 2;
     */
    token: string;
    /**
     * @generated from field: string expires_at = 3;
     */
    expiresAt: string;
    /**
     * @generated from field: string user_id = 4;
     */
    userId: string;
    /**
     * @generated from field: optional string ip_address = 5;
     */
    ipAddress?: string;
    /**
     * @generated from field: optional string user_agent = 6;
     */
    userAgent?: string;
};
/**
 * Describes the message auth.v1.Session.
 * Use `create(SessionSchema)` to create a new message.
 */
export declare const SessionSchema: GenMessage<Session>;
/**
 * @generated from message auth.v1.Account
 */
export type Account = Message<"auth.v1.Account"> & {
    /**
     * @generated from field: string id = 1;
     */
    id: string;
    /**
     * @generated from field: string account_id = 2;
     */
    accountId: string;
    /**
     * @generated from field: string provider_id = 3;
     */
    providerId: string;
    /**
     * @generated from field: string user_id = 4;
     */
    userId: string;
    /**
     * @generated from field: optional string access_token = 5;
     */
    accessToken?: string;
    /**
     * @generated from field: optional string refresh_token = 6;
     */
    refreshToken?: string;
    /**
     * @generated from field: optional string scope = 7;
     */
    scope?: string;
};
/**
 * Describes the message auth.v1.Account.
 * Use `create(AccountSchema)` to create a new message.
 */
export declare const AccountSchema: GenMessage<Account>;
/**
 * AuthService メッセージ
 *
 * @generated from message auth.v1.VerifySessionRequest
 */
export type VerifySessionRequest = Message<"auth.v1.VerifySessionRequest"> & {
    /**
     * @generated from field: string session_token = 1;
     */
    sessionToken: string;
};
/**
 * Describes the message auth.v1.VerifySessionRequest.
 * Use `create(VerifySessionRequestSchema)` to create a new message.
 */
export declare const VerifySessionRequestSchema: GenMessage<VerifySessionRequest>;
/**
 * @generated from message auth.v1.VerifySessionResponse
 */
export type VerifySessionResponse = Message<"auth.v1.VerifySessionResponse"> & {
    /**
     * @generated from field: optional auth.v1.User user = 1;
     */
    user?: User;
    /**
     * @generated from field: optional auth.v1.Session session = 2;
     */
    session?: Session;
};
/**
 * Describes the message auth.v1.VerifySessionResponse.
 * Use `create(VerifySessionResponseSchema)` to create a new message.
 */
export declare const VerifySessionResponseSchema: GenMessage<VerifySessionResponse>;
/**
 * @generated from message auth.v1.GetUserRequest
 */
export type GetUserRequest = Message<"auth.v1.GetUserRequest"> & {
    /**
     * @generated from field: string user_id = 1;
     */
    userId: string;
};
/**
 * Describes the message auth.v1.GetUserRequest.
 * Use `create(GetUserRequestSchema)` to create a new message.
 */
export declare const GetUserRequestSchema: GenMessage<GetUserRequest>;
/**
 * @generated from message auth.v1.GetUserResponse
 */
export type GetUserResponse = Message<"auth.v1.GetUserResponse"> & {
    /**
     * @generated from field: optional auth.v1.User user = 1;
     */
    user?: User;
};
/**
 * Describes the message auth.v1.GetUserResponse.
 * Use `create(GetUserResponseSchema)` to create a new message.
 */
export declare const GetUserResponseSchema: GenMessage<GetUserResponse>;
/**
 * @generated from message auth.v1.FindAccountByUserIdRequest
 */
export type FindAccountByUserIdRequest = Message<"auth.v1.FindAccountByUserIdRequest"> & {
    /**
     * @generated from field: string user_id = 1;
     */
    userId: string;
};
/**
 * Describes the message auth.v1.FindAccountByUserIdRequest.
 * Use `create(FindAccountByUserIdRequestSchema)` to create a new message.
 */
export declare const FindAccountByUserIdRequestSchema: GenMessage<FindAccountByUserIdRequest>;
/**
 * @generated from message auth.v1.FindAccountByUserIdResponse
 */
export type FindAccountByUserIdResponse = Message<"auth.v1.FindAccountByUserIdResponse"> & {
    /**
     * @generated from field: optional auth.v1.Account account = 1;
     */
    account?: Account;
};
/**
 * Describes the message auth.v1.FindAccountByUserIdResponse.
 * Use `create(FindAccountByUserIdResponseSchema)` to create a new message.
 */
export declare const FindAccountByUserIdResponseSchema: GenMessage<FindAccountByUserIdResponse>;
/**
 * @generated from message auth.v1.SignOutRequest
 */
export type SignOutRequest = Message<"auth.v1.SignOutRequest"> & {
    /**
     * @generated from field: string session_token = 1;
     */
    sessionToken: string;
};
/**
 * Describes the message auth.v1.SignOutRequest.
 * Use `create(SignOutRequestSchema)` to create a new message.
 */
export declare const SignOutRequestSchema: GenMessage<SignOutRequest>;
/**
 * @generated from message auth.v1.SignOutResponse
 */
export type SignOutResponse = Message<"auth.v1.SignOutResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
};
/**
 * Describes the message auth.v1.SignOutResponse.
 * Use `create(SignOutResponseSchema)` to create a new message.
 */
export declare const SignOutResponseSchema: GenMessage<SignOutResponse>;
/**
 * @generated from message auth.v1.SendMagicLinkRequest
 */
export type SendMagicLinkRequest = Message<"auth.v1.SendMagicLinkRequest"> & {
    /**
     * @generated from field: string email = 1;
     */
    email: string;
    /**
     * @generated from field: string callback_url = 2;
     */
    callbackUrl: string;
};
/**
 * Describes the message auth.v1.SendMagicLinkRequest.
 * Use `create(SendMagicLinkRequestSchema)` to create a new message.
 */
export declare const SendMagicLinkRequestSchema: GenMessage<SendMagicLinkRequest>;
/**
 * @generated from message auth.v1.SendMagicLinkResponse
 */
export type SendMagicLinkResponse = Message<"auth.v1.SendMagicLinkResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
};
/**
 * Describes the message auth.v1.SendMagicLinkResponse.
 * Use `create(SendMagicLinkResponseSchema)` to create a new message.
 */
export declare const SendMagicLinkResponseSchema: GenMessage<SendMagicLinkResponse>;
/**
 * UserService メッセージ
 *
 * @generated from message auth.v1.FindUserByEmailRequest
 */
export type FindUserByEmailRequest = Message<"auth.v1.FindUserByEmailRequest"> & {
    /**
     * @generated from field: string email = 1;
     */
    email: string;
};
/**
 * Describes the message auth.v1.FindUserByEmailRequest.
 * Use `create(FindUserByEmailRequestSchema)` to create a new message.
 */
export declare const FindUserByEmailRequestSchema: GenMessage<FindUserByEmailRequest>;
/**
 * @generated from message auth.v1.FindUserByEmailResponse
 */
export type FindUserByEmailResponse = Message<"auth.v1.FindUserByEmailResponse"> & {
    /**
     * @generated from field: optional auth.v1.User user = 1;
     */
    user?: User;
};
/**
 * Describes the message auth.v1.FindUserByEmailResponse.
 * Use `create(FindUserByEmailResponseSchema)` to create a new message.
 */
export declare const FindUserByEmailResponseSchema: GenMessage<FindUserByEmailResponse>;
/**
 * @generated from message auth.v1.FindUserByIdRequest
 */
export type FindUserByIdRequest = Message<"auth.v1.FindUserByIdRequest"> & {
    /**
     * @generated from field: string user_id = 1;
     */
    userId: string;
};
/**
 * Describes the message auth.v1.FindUserByIdRequest.
 * Use `create(FindUserByIdRequestSchema)` to create a new message.
 */
export declare const FindUserByIdRequestSchema: GenMessage<FindUserByIdRequest>;
/**
 * @generated from message auth.v1.FindUserByIdResponse
 */
export type FindUserByIdResponse = Message<"auth.v1.FindUserByIdResponse"> & {
    /**
     * @generated from field: optional auth.v1.User user = 1;
     */
    user?: User;
};
/**
 * Describes the message auth.v1.FindUserByIdResponse.
 * Use `create(FindUserByIdResponseSchema)` to create a new message.
 */
export declare const FindUserByIdResponseSchema: GenMessage<FindUserByIdResponse>;
/**
 * @generated from message auth.v1.UpdateUserRequest
 */
export type UpdateUserRequest = Message<"auth.v1.UpdateUserRequest"> & {
    /**
     * @generated from field: string user_id = 1;
     */
    userId: string;
    /**
     * @generated from field: optional string name = 2;
     */
    name?: string;
    /**
     * @generated from field: optional string image = 3;
     */
    image?: string;
    /**
     * true で image を null に設定（clearImage 相当）
     *
     * @generated from field: bool clear_image = 4;
     */
    clearImage: boolean;
};
/**
 * Describes the message auth.v1.UpdateUserRequest.
 * Use `create(UpdateUserRequestSchema)` to create a new message.
 */
export declare const UpdateUserRequestSchema: GenMessage<UpdateUserRequest>;
/**
 * @generated from message auth.v1.UpdateUserResponse
 */
export type UpdateUserResponse = Message<"auth.v1.UpdateUserResponse"> & {
    /**
     * @generated from field: auth.v1.User user = 1;
     */
    user?: User;
};
/**
 * Describes the message auth.v1.UpdateUserResponse.
 * Use `create(UpdateUserResponseSchema)` to create a new message.
 */
export declare const UpdateUserResponseSchema: GenMessage<UpdateUserResponse>;
/**
 * @generated from message auth.v1.DeleteUserRequest
 */
export type DeleteUserRequest = Message<"auth.v1.DeleteUserRequest"> & {
    /**
     * @generated from field: string user_id = 1;
     */
    userId: string;
};
/**
 * Describes the message auth.v1.DeleteUserRequest.
 * Use `create(DeleteUserRequestSchema)` to create a new message.
 */
export declare const DeleteUserRequestSchema: GenMessage<DeleteUserRequest>;
/**
 * @generated from message auth.v1.DeleteUserResponse
 */
export type DeleteUserResponse = Message<"auth.v1.DeleteUserResponse"> & {
    /**
     * @generated from field: bool success = 1;
     */
    success: boolean;
};
/**
 * Describes the message auth.v1.DeleteUserResponse.
 * Use `create(DeleteUserResponseSchema)` to create a new message.
 */
export declare const DeleteUserResponseSchema: GenMessage<DeleteUserResponse>;
/**
 * 認証（セッション管理、OAuth、Magic Link）
 *
 * @generated from service auth.v1.AuthService
 */
export declare const AuthService: GenService<{
    /**
     * @generated from rpc auth.v1.AuthService.VerifySession
     */
    verifySession: {
        methodKind: "unary";
        input: typeof VerifySessionRequestSchema;
        output: typeof VerifySessionResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.AuthService.GetUser
     */
    getUser: {
        methodKind: "unary";
        input: typeof GetUserRequestSchema;
        output: typeof GetUserResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.AuthService.FindAccountByUserId
     */
    findAccountByUserId: {
        methodKind: "unary";
        input: typeof FindAccountByUserIdRequestSchema;
        output: typeof FindAccountByUserIdResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.AuthService.SignOut
     */
    signOut: {
        methodKind: "unary";
        input: typeof SignOutRequestSchema;
        output: typeof SignOutResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.AuthService.SendMagicLink
     */
    sendMagicLink: {
        methodKind: "unary";
        input: typeof SendMagicLinkRequestSchema;
        output: typeof SendMagicLinkResponseSchema;
    };
}>;
/**
 * ユーザー管理（user テーブルが auth-service DB に存在するため必要）
 *
 * @generated from service auth.v1.UserService
 */
export declare const UserService: GenService<{
    /**
     * @generated from rpc auth.v1.UserService.FindUserByEmail
     */
    findUserByEmail: {
        methodKind: "unary";
        input: typeof FindUserByEmailRequestSchema;
        output: typeof FindUserByEmailResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.UserService.FindUserById
     */
    findUserById: {
        methodKind: "unary";
        input: typeof FindUserByIdRequestSchema;
        output: typeof FindUserByIdResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.UserService.UpdateUser
     */
    updateUser: {
        methodKind: "unary";
        input: typeof UpdateUserRequestSchema;
        output: typeof UpdateUserResponseSchema;
    };
    /**
     * @generated from rpc auth.v1.UserService.DeleteUser
     */
    deleteUser: {
        methodKind: "unary";
        input: typeof DeleteUserRequestSchema;
        output: typeof DeleteUserResponseSchema;
    };
}>;
//# sourceMappingURL=auth_pb.d.ts.map