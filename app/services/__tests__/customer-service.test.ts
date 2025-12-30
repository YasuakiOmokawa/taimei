import { describe, it, expect } from "vitest";
import { Effect, Either, Layer } from "effect";
import { CustomerService } from "../customer-service";
import { CustomerRepository } from "../customer-repository";
import { runWithLayer } from "./test-helpers";

type Customer = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
};

type FilteredCustomer = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  totalInvoices: number;
  totalPending: number;
  totalPaid: number;
};

const createMockRepository = (
  customers: Customer[] = [],
  filteredCustomers: FilteredCustomer[] = []
) =>
  new CustomerRepository({
    findAll: () =>
      Effect.succeed(
        customers.map((c) => ({
          id: c.id,
          name: c.name,
        }))
      ),

    fetchFiltered: (_query: string) => Effect.succeed(filteredCustomers),
  });

const createTestLayer = (
  customers: Customer[] = [],
  filteredCustomers: FilteredCustomer[] = []
) =>
  CustomerService.Default.pipe(
    Layer.provide(
      Layer.succeed(
        CustomerRepository,
        createMockRepository(customers, filteredCustomers)
      )
    )
  );

describe("CustomerService", () => {
  describe("findAll", () => {
    it("正常系: すべての顧客を取得できる", async () => {
      const customers: Customer[] = [
        {
          id: "customer-1",
          name: "Alice",
          email: "alice@example.com",
          imageUrl: "https://example.com/alice.png",
        },
        {
          id: "customer-2",
          name: "Bob",
          email: "bob@example.com",
          imageUrl: "https://example.com/bob.png",
        },
      ];

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* CustomerService;
          return yield* service.findAll();
        }),
        createTestLayer(customers)
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toHaveLength(2);
        expect(result.right[0].name).toBe("Alice");
        expect(result.right[1].name).toBe("Bob");
      }
    });

    it("正常系: 顧客がいない場合は空配列を返す", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* CustomerService;
          return yield* service.findAll();
        }),
        createTestLayer()
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toHaveLength(0);
      }
    });
  });

  describe("fetchFiltered", () => {
    it("正常系: フィルタリングされた顧客を取得できる", async () => {
      const filteredCustomers: FilteredCustomer[] = [
        {
          id: "customer-1",
          name: "Alice",
          email: "alice@example.com",
          imageUrl: "https://example.com/alice.png",
          totalInvoices: 5,
          totalPending: 10000,
          totalPaid: 50000,
        },
      ];

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* CustomerService;
          return yield* service.fetchFiltered("alice");
        }),
        createTestLayer([], filteredCustomers)
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toHaveLength(1);
        expect(result.right[0].name).toBe("Alice");
        expect(result.right[0].totalInvoices).toBe(5);
        expect(result.right[0].totalPending).toBe(10000);
        expect(result.right[0].totalPaid).toBe(50000);
      }
    });
  });
});
