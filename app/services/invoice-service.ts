import { Data, Effect, Layer } from "effect";
import {
  InvoiceRepository,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from "./invoice-repository";

const makeInvoiceService = Effect.gen(function* () {
  const repository = yield* InvoiceRepository;

  return {
    create: (input: CreateInvoiceInput) => repository.create(input),

    update: (input: UpdateInvoiceInput) =>
      Effect.gen(function* () {
        const result = yield* repository.update(input);
        if (!result) {
          return yield* new InvoiceNotFound({ id: input.id });
        }
        return result;
      }),

    delete: (id: string) =>
      Effect.gen(function* () {
        const existing = yield* repository.findById(id);
        if (!existing) {
          return yield* new InvoiceNotFound({ id });
        }
        yield* repository.delete(id);
      }),

    findById: (id: string) =>
      Effect.gen(function* () {
        const result = yield* repository.findById(id);
        if (!result) {
          return yield* new InvoiceNotFound({ id });
        }
        return result;
      }),

    fetchFiltered: (query: string, currentPage: number) =>
      repository.fetchFiltered(query, currentPage),

    fetchPages: (query: string) => repository.fetchPages(query),
  };
});

export class InvoiceService extends Effect.Tag("services/InvoiceService")<
  InvoiceService,
  Effect.Effect.Success<typeof makeInvoiceService>
>() {
  static Live = Layer.effect(this, makeInvoiceService);
}

export class InvoiceNotFound extends Data.TaggedError("InvoiceNotFound")<{
  id: string;
}> {}
