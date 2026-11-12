import type { Html, HtmlBuilder } from "foldkit/html";
import { Submission } from "../submission";

export const rejectionAlertView = <Message>(
  submission: Submission,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Submission.match(submission, {
    Idle: () => [],
    Submitting: () => [],
    Rejected: ({ message }) => [
      h.p([h.Role("alert"), h.Class("text-sm text-destructive")], [message]),
    ],
  });
