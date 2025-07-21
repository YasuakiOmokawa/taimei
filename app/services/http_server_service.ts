import { Context } from "effect";

export class HttpServerService extends Context.Tag(
  "app/services/HttpServerService"
)<HttpServerService, void>() {}
