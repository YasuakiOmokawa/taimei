import { Data } from "effect";

export class DashboardServiceError extends Data.TaggedError(
  "DashboardServiceError",
)<{
  message: string;
}> {}
