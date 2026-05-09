"use client";

import {
  FormProvider as ConformFormProvider,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useRouter } from "next/navigation";
import { ReactNode, startTransition, useActionState } from "react";
import { toast } from "sonner";
import { createData } from "@/app/use-conform/action";
import { schema } from "@/app/use-conform/schema";
import { withCallbacks } from "@/lib/with-callbacks";

export default function FormProvider({ children }: { children: ReactNode }) {
  const [lastResult, formAction] = useActionState(
    withCallbacks(createData, {
      onError(result) {
        if (result.error) {
          const formErrors = result.error[""];
          toast.error(formErrors?.at(0));
        }
      },
    }),
    undefined,
  );
  const router = useRouter();
  const [form] = useForm({
    lastResult,
    constraint: getZodConstraint(schema),
    defaultValue: {
      email: "",
      name: "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onSubmit(event, { formData }) {
      event.preventDefault();

      switch (formData.get("intent")) {
        case "confirm":
          router.push("/use-conform/create/confirm");
          break;
        case "submit":
          startTransition(() => {
            formAction(formData);
          });
          break;
        default:
          break;
      }
    },
  });

  return (
    <ConformFormProvider context={form.context}>{children}</ConformFormProvider>
  );
}
