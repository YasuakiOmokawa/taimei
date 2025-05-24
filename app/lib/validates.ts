import { z } from "zod/v4";

const InvoiceFormSchema = z.object({
  id: z.string(),
  date: z.date(),
  customerId: z.string({
    error: (issue) =>
      issue.input === undefined
        ? "Customer is required."
        : "Please select a customer.",
  }),
  amount: z.coerce.number().gt(0, "Please enter an amount greater than $0."),
  status: z.enum(["paid", "pending"], {
    error: (issue) =>
      issue.input === undefined
        ? "Invoice status is required."
        : "Please select an invoice status.",
  }),
});

const CreateInvoiceForm = InvoiceFormSchema.omit({ id: true, date: true });

export const validatesCreateInvoice = (data: {
  [key: string]: FormDataEntryValue;
}) => CreateInvoiceForm.safeParse(data);

const UpdateInvoiceForm = InvoiceFormSchema.omit({ id: true, date: true });

export const validatesUpdateInvoice = (data: {
  [key: string]: FormDataEntryValue;
}) => UpdateInvoiceForm.safeParse(data);
