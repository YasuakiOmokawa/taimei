import { Effect, Layer } from "effect";
import { CustomerRepository } from "./customer-repository";

const makeCustomerService = Effect.gen(function* () {
  const repository = yield* CustomerRepository;

  return {
    findAll: () => repository.findAll(),
    fetchFiltered: (query: string) => repository.fetchFiltered(query),
  };
});

export class CustomerService extends Effect.Tag("services/CustomerService")<
  CustomerService,
  Effect.Effect.Success<typeof makeCustomerService>
>() {
  static Live = Layer.effect(this, makeCustomerService);
}
