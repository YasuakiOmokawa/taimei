import { Select } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { fieldClassName } from "./class-names";

type SelectLook = "field" | "levelSymbol";

const CLASS_BY_LOOK: Record<SelectLook, string> = {
  field: fieldClassName,
  levelSymbol: "rounded-md border-input font-symbol text-sm",
};

export const selectView = <Message>(
  config: Readonly<{
    id: string;
    label: string;
    value: string;
    options: ReadonlyArray<Readonly<{ value: string; label: string }>>;
    onChange: (value: string) => Message;
    look: SelectLook;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  Select.view(
    {
      id: config.id,
      value: config.value,
      onChange: config.onChange,
      toView: (attributes) =>
        h.select(
          [
            ...attributes.select,
            h.AriaLabel(config.label),
            h.Class(CLASS_BY_LOOK[config.look]),
          ],
          config.options.map((option) =>
            h.keyed("option")(
              option.value,
              [
                h.Value(option.value),
                h.Selected(option.value === config.value),
              ],
              [option.label],
            ),
          ),
        ),
    },
    h,
  );
