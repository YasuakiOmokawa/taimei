import { Effect } from "effect";
import { CustomerRepository } from "./customer-repository";

export class CustomerService extends Effect.Service<CustomerService>()(
  "services/CustomerService",
  {
    effect: Effect.gen(function* () {
      const repository = yield* CustomerRepository;

      return {
        findAll: () => repository.findAll(),
        fetchFiltered: (query: string) => repository.fetchFiltered(query),
      } as const;
    }),
  }
) {}
