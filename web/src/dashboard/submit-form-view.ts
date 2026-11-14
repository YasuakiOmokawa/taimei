import type { Html, HtmlBuilder } from "foldkit/html";
import type { Submission } from "../shared/submission";
import { rejectionAlertView } from "../shared/ui/alert-text-view";
import { buttonView } from "../shared/ui/button-view";

export const submitFormView = <Message>(
  config: Readonly<{
    control: Html;
    submitLabel: string;
    submission: Submission;
    isBlocked: boolean;
    onSubmit: Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.form(
    [h.Class("space-y-1"), h.OnSubmit(config.onSubmit)],
    [
      h.div(
        [h.Class("flex flex-wrap items-center gap-2")],
        [
          config.control,
          buttonView(
            {
              look: "primarySmall",
              type: "submit",
              label: config.submitLabel,
              submission: config.submission,
              isBlocked: config.isBlocked,
            },
            h,
          ),
        ],
      ),
      ...rejectionAlertView(config.submission, h),
    ],
  );
