import { Input } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { fieldClassName } from "./class-names";

export const inputView = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    value: string;
    onInput: (value: string) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  Input.view(
    {
      id: config.id,
      value: config.value,
      placeholder: config.label,
      onInput: config.onInput,
      toView: (attributes) =>
        h.input([
          ...attributes.input,
          h.AriaLabel(config.label),
          h.Required(true),
          h.Class(fieldClassName),
        ]),
    },
    h,
  );

export const checkboxView = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    accessibleName: string;
    isChecked: boolean;
    onToggle: (isChecked: boolean) => Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  Input.view(
    {
      id: config.id,
      type: "checkbox",
      toView: (attributes) =>
        h.label(
          [h.Class("flex items-center gap-2")],
          [
            h.input([
              ...attributes.input,
              h.AriaLabel(config.accessibleName),
              h.Checked(config.isChecked),
              h.OnClick(config.onToggle(!config.isChecked)),
              h.Class(
                "size-4 rounded border-input text-primary focus:ring-ring",
              ),
            ]),
            config.label,
          ],
        ),
    },
    h,
  );
