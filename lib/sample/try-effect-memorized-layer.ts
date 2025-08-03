import { Effect, Context, Layer } from "effect";

class A extends Context.Tag("A")<A, { readonly a: number }>() {}
class B extends Context.Tag("B")<B, { readonly b: string }>() {}
class C extends Context.Tag("C")<C, { readonly c: boolean }>() {}
