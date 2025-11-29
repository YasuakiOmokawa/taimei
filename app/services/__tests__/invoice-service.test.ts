import { describe, it, expect } from "vitest";
import { Effect, Either, Layer } from "effect";
import { InvoiceService, InvoiceNotFound } from "../invoice-service";
import {
  InvoiceRepository,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from "../invoice-repository";
import { runWithLayer } from "./test-helpers";

// テスト用 Invoice 型
type Invoice = {
  id: string;
  customerId: string;
  amount: number;
  status: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

// テスト用のモックリポジトリを作成
const createMockRepository = (initialInvoices: Invoice[] = []) => {
  const invoices = [...initialInvoices];
  let idCounter = 1;

  return {
    create: (input: CreateInvoiceInput) =>
      Effect.succeed({
        id: `test-invoice-${idCounter++}`,
        ...input,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Invoice),

    update: (input: UpdateInvoiceInput) =>
      Effect.succeed(
        (() => {
          const index = invoices.findIndex((inv) => inv.id === input.id);
          if (index === -1) return undefined;
          invoices[index] = {
            ...invoices[index],
            customerId: input.customerId,
            amount: input.amount,
            status: input.status,
            updatedAt: new Date().toISOString(),
          };
          return invoices[index];
        })()
      ),

    delete: (id: string) =>
      Effect.succeed(
        (() => {
          const index = invoices.findIndex((inv) => inv.id === id);
          if (index === -1) return [];
          return invoices.splice(index, 1);
        })()
      ),

    findById: (id: string) =>
      Effect.succeed(invoices.find((inv) => inv.id === id)),

    fetchFiltered: (_query: string, _currentPage: number, _itemsPerPage = 6) =>
      Effect.succeed(
        invoices.map((inv) => ({
          id: inv.id,
          amount: inv.amount,
          date: inv.date,
          status: inv.status,
          name: "Test Customer",
          email: "test@example.com",
          imageUrl: "https://example.com/avatar.png",
        }))
      ),

    fetchPages: (_query: string, _itemsPerPage = 6) =>
      Effect.succeed(Math.ceil(invoices.length / _itemsPerPage)),
  };
};

// テスト用 Layer を構築
const createTestLayer = (initialInvoices: Invoice[] = []) =>
  InvoiceService.Live.pipe(
    Layer.provide(
      Layer.succeed(InvoiceRepository, createMockRepository(initialInvoices))
    )
  );

describe("InvoiceService", () => {
  describe("create", () => {
    it("正常系: Invoice を作成できる", async () => {
      const input: CreateInvoiceInput = {
        customerId: "customer-1",
        amount: 10000,
        status: "pending",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.create(input);
        }),
        createTestLayer()
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id).toBe("test-invoice-1");
        expect(result.right.customerId).toBe("customer-1");
        expect(result.right.amount).toBe(10000);
        expect(result.right.status).toBe("pending");
      }
    });
  });

  describe("update", () => {
    it("正常系: 既存の Invoice を更新できる", async () => {
      const existingInvoice: Invoice = {
        id: "existing-invoice-1",
        customerId: "customer-1",
        amount: 10000,
        status: "pending",
        date: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const input: UpdateInvoiceInput = {
        id: "existing-invoice-1",
        customerId: "customer-2",
        amount: 20000,
        status: "paid",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.update(input);
        }),
        createTestLayer([existingInvoice])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id).toBe("existing-invoice-1");
        expect(result.right.customerId).toBe("customer-2");
        expect(result.right.amount).toBe(20000);
        expect(result.right.status).toBe("paid");
      }
    });

    it("異常系: 存在しない Invoice を更新しようとするとエラー", async () => {
      const input: UpdateInvoiceInput = {
        id: "non-existent-id",
        customerId: "customer-1",
        amount: 10000,
        status: "pending",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.update(input);
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InvoiceNotFound);
        expect(result.left._tag).toBe("InvoiceNotFound");
      }
    });
  });

  describe("delete", () => {
    it("正常系: 既存の Invoice を削除できる", async () => {
      const existingInvoice: Invoice = {
        id: "existing-invoice-1",
        customerId: "customer-1",
        amount: 10000,
        status: "pending",
        date: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.delete("existing-invoice-1");
        }),
        createTestLayer([existingInvoice])
      );

      expect(Either.isRight(result)).toBe(true);
    });

    it("異常系: 存在しない Invoice を削除しようとするとエラー", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.delete("non-existent-id");
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InvoiceNotFound);
        expect(result.left._tag).toBe("InvoiceNotFound");
      }
    });
  });

  describe("findById", () => {
    it("正常系: 既存の Invoice を取得できる", async () => {
      const existingInvoice: Invoice = {
        id: "existing-invoice-1",
        customerId: "customer-1",
        amount: 10000,
        status: "pending",
        date: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.findById("existing-invoice-1");
        }),
        createTestLayer([existingInvoice])
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id).toBe("existing-invoice-1");
        expect(result.right.customerId).toBe("customer-1");
      }
    });

    it("異常系: 存在しない Invoice を取得しようとするとエラー", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const service = yield* InvoiceService;
          return yield* service.findById("non-existent-id");
        }),
        createTestLayer()
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(InvoiceNotFound);
        expect(result.left._tag).toBe("InvoiceNotFound");
      }
    });
  });
});
