import { z } from "zod";

export const invoiceSchema = z.object({
  customerId: z.string({
    error: (issue) =>
      issue.input === undefined ? "顧客は必須です" : "顧客を選択してください",
  }),
  amount: z.coerce.number().gt(0, "0より大きい金額を入力してください"),
  status: z.enum(["paid", "pending"], {
    error: (issue) =>
      issue.input === undefined
        ? "ステータスは必須です"
        : "ステータスを選択してください",
  }),
});
